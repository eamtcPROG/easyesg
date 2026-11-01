import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { configureHttpApp } from '../src/main.http';
import { MEMBERSHIP_ROLE } from '../src/modules/identity/membership/models/membership.model';
import { asOrganization, connectAs, deleteNoticeWithdrawalsOf } from './support/database';
import { cleanupSignedInAccounts, signInFreshAccount, type SignedInAccount } from './support/signed-in-account';

const ORG = '01930000-0000-7000-8000-0000000000d2';
const EMAILS = { admin: 'oa@report-deletion.test', editor: 'rc@report-deletion.test', viewer: 'viewer@report-deletion.test' };
const CHISINAU = 'Europe/Chisinau';
const PROBLEM_BASE = 'https://easyesg.md/problems/';

/**
 * UC-213 end to end (task 192; FR-210; `architecture.md` §12.5.6's task-192 row): the Organization Administrator
 * deletes a report made in error — it leaves every list and route, nothing is removed, the trail names who, its
 * outstanding-report notice is withdrawn, and its period takes a new report — and the three refusals hold: a member who
 * is not the administrator, a locked period, and a report a file of which was exported or is being made, while one whose
 * only export failed is deleted.
 *
 * **Row security is what hides it, and it is asserted where no route reaches**: the worker's role reads the table and
 * finds nothing, so the sweeps cannot raise a notice about a deleted report.
 */
describe('deleting a report (task 192)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let worker: DataSource;
  let admin: SignedInAccount;
  let editor: SignedInAccount;
  let viewer: SignedInAccount;
  let entityId: string;

  const http = () => request(app.getHttpServer());
  const objectOf = <T>(body: unknown): T => (body as { object: T }).object;
  const objectsOf = <T>(body: unknown): T[] => (body as { objects: T[] }).objects;
  const problemType = (response: request.Response): string => (response.body as { type: string }).type;

  const removeFixtures = async (): Promise<void> => {
    await owner.query(`DELETE FROM audit.outbox_event WHERE organization_id = $1`, [ORG]);
    await asOrganization(owner, ORG, (run) => run(`DELETE FROM core.organization WHERE id = $1`, [ORG]));
    await owner.query(`DELETE FROM identity.account WHERE email = ANY($1)`, [Object.values(EMAILS)]);
  };

  const openPeriod = async (fiscalYear: number): Promise<string> => {
    const period = await http().post('/api/v1/periods').set(admin.authorization).send({
      reportingEntityId: entityId,
      fiscalYear,
      periodStart: { date: `${fiscalYear}-01-01`, timezone: CHISINAU },
      periodEnd: { date: `${fiscalYear}-12-31`, timezone: CHISINAU },
    }).expect(201);
    return objectOf<{ id: string }>(period.body).id;
  };

  const openReport = async (periodId: string): Promise<string> => {
    const report = await http().post('/api/v1/reports').set(editor.authorization).send({ reportingPeriodId: periodId }).expect(201);
    return objectOf<{ id: string }>(report.body).id;
  };

  /** The report row as the owner sees it, past the policy that hides a deleted one. */
  const storedRow = (reportId: string) =>
    asOrganization(owner, ORG, (run) => run(`SELECT deleted_at FROM core.report WHERE id = $1`, [reportId])) as Promise<
      { deleted_at: Date | null }[]
    >;

  beforeAll(async () => {
    await initialiseCatalogue();
    @Module({ imports: [AppModule] })
    class TestAppModule {}
    app = await NestFactory.create<NestExpressApplication>(TestAppModule, { logger: false, abortOnError: false });
    configureHttpApp(app);
    await app.init();

    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-report-deletion-owner');
    worker = await connectAs('DB_WORKER_USER', 'DB_WORKER_PASSWORD', 'easyesg-report-deletion-worker');
    await removeFixtures();
    await asOrganization(owner, null, (run) =>
      run(`INSERT INTO core.organization (id, name, country_code) VALUES ($1, 'Vinăria Ștearsă SRL', 'MD')`, [ORG]));
    const server = app.getHttpServer();
    admin = await signInFreshAccount({ server, worker, email: EMAILS.admin });
    editor = await signInFreshAccount({ server, worker, email: EMAILS.editor });
    viewer = await signInFreshAccount({ server, worker, email: EMAILS.viewer });
    for (const [account, role] of [
      [admin, MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR],
      [editor, MEMBERSHIP_ROLE.EDITOR],
      [viewer, MEMBERSHIP_ROLE.VIEWER],
    ] as const) {
      await asOrganization(owner, ORG, (run) =>
        run(`INSERT INTO identity.membership (account_id, organization_id, role) VALUES ($1,$2,$3)`, [account.accountId, ORG, role]));
    }
    const entity = await http().post('/api/v1/entities').set(admin.authorization).send({
      name: 'Vinăria Ștearsă', legalForm: 'srl', naceCodes: ['11.02'], idno: '1003600005148',
      sites: [{ name: 'Crama', locality: 'Cricova', countryCode: 'MD' }],
    }).expect(201);
    entityId = objectOf<{ id: string }>(entity.body).id;
  }, 120_000);

  afterAll(async () => {
    await deleteNoticeWithdrawalsOf({ owner, organizationIds: [ORG] });
    await cleanupSignedInAccounts({ owner });
    await removeFixtures();
    await app?.close();
    for (const source of [owner, worker]) if (source?.isInitialized) await source.destroy();
  });

  it('deletes a never-exported report: gone from every list and route, kept in storage, its trail and notice handled (AC-1, 6, 7, 8)', async () => {
    const periodId = await openPeriod(2026);
    const reportId = await openReport(periodId);
    // A run, so there is something retained to find afterwards (FR-210 behaviour 4).
    await http().post(`/api/v1/reports/${reportId}/validation/runs`).set(editor.authorization).expect(201);

    await http().delete(`/api/v1/reports/${reportId}`).set(admin.authorization).expect(204);

    const gone = await http().get(`/api/v1/reports/${reportId}`).set(admin.authorization).expect(404);
    expect(problemType(gone)).toBe(`${PROBLEM_BASE}not-found`);
    const listed = await http().get('/api/v1/reports').set(admin.authorization).expect(200);
    expect(objectsOf<{ id: string }>(listed.body).map((report) => report.id)).not.toContain(reportId);
    const period = await http().get(`/api/v1/periods/${periodId}`).set(admin.authorization).expect(200);
    expect(objectOf<{ report: unknown }>(period.body).report).toBeNull();
    await http().delete(`/api/v1/reports/${reportId}`).set(admin.authorization).expect(404);

    // Nothing is removed: the row is marked, and its run is still there.
    const [row] = await storedRow(reportId);
    expect(row?.deleted_at).toBeInstanceOf(Date);
    const runs = (await asOrganization(owner, ORG, (run) =>
      run(`SELECT count(*)::int AS runs FROM core.validation_run WHERE report_id = $1`, [reportId]))) as { runs: number }[];
    expect(runs[0]?.runs).toBe(1);

    // The trail names who marked it, and when (FR-159) — the mark itself, beside the creation that wrote the column empty.
    const trail = (await asOrganization(owner, ORG, (run) =>
      run(
        `SELECT actor_id, new_value FROM core.field_change
          WHERE table_name = 'core.report' AND record_id = $1 AND field_name = 'deleted_at' AND new_value IS NOT NULL`,
        [reportId],
      ))) as { actor_id: string; new_value: unknown }[];
    expect(trail).toHaveLength(1);
    expect(trail[0]?.actor_id).toBe(admin.accountId);

    // Its outstanding-report notice is withdrawn in the deletion's transaction (row (c)).
    const withdrawn = await owner.query<{ subject: string }[]>(
      `SELECT payload->>'subjectRef' AS subject FROM audit.outbox_event
        WHERE organization_id = $1 AND event_type = 'platform.notification.cancelled'`,
      [ORG],
    );
    expect(withdrawn.map((event) => event.subject)).toContain(`report:${reportId}:outstanding`);

    // The worker's role reads the table and finds nothing: the sweeps cannot reach a deleted report (row (2)).
    const seenByWorker = (await asOrganization(worker, ORG, (run) =>
      run(`SELECT count(*)::int AS seen FROM core.report WHERE id = $1`, [reportId]))) as { seen: number }[];
    expect(seenByWorker[0]?.seen).toBe(0);

    // The period stays open and takes a new report (AC-9; row (b)).
    const replacement = await openReport(periodId);
    expect(replacement).not.toBe(reportId);
  });

  it('refuses anyone but the administrator, and changes nothing (AC-2)', async () => {
    const reportId = await openReport(await openPeriod(2027));
    for (const account of [editor, viewer]) {
      const refused = await http().delete(`/api/v1/reports/${reportId}`).set(account.authorization).expect(403);
      expect(problemType(refused)).toBe(`${PROBLEM_BASE}insufficient-role`);
    }
    const [row] = await storedRow(reportId);
    expect(row?.deleted_at).toBeNull();
  });

  it('refuses a report whose period is locked (AC-3; FR-22)', async () => {
    const periodId = await openPeriod(2028);
    const reportId = await openReport(periodId);
    await http().post(`/api/v1/periods/${periodId}/lock`).set(admin.authorization).expect(200);

    const refused = await http().delete(`/api/v1/reports/${reportId}`).set(admin.authorization).expect(409);
    expect(problemType(refused)).toBe(`${PROBLEM_BASE}report-not-editable`);
    const read = await http().get(`/api/v1/reports/${reportId}`).set(admin.authorization).expect(200);
    expect(objectOf<{ locked: boolean; exported: boolean }>(read.body)).toMatchObject({ locked: true, exported: false });
  });

  it('refuses a report an export of which is being made, and deletes it once that export has failed (AC-4, AC-5; row (1))', async () => {
    const reportId = await openReport(await openPeriod(2025));
    const queued = await http().post(`/api/v1/reports/${reportId}/exports`).set(editor.authorization)
      .send({ format: 'pdf', locale: 'en', acknowledgeUnresolvedFindings: true }).expect(202);
    const exportId = objectOf<{ id: string }>(queued.body).id;

    const read = await http().get(`/api/v1/reports/${reportId}`).set(admin.authorization).expect(200);
    expect(objectOf<{ exported: boolean }>(read.body).exported).toBe(true);
    const refused = await http().delete(`/api/v1/reports/${reportId}`).set(admin.authorization).expect(409);
    expect(problemType(refused)).toBe(`${PROBLEM_BASE}report-exported`);

    // A failed export left no file, so it neither marks the report exported nor refuses the deletion.
    await asOrganization(owner, ORG, (run) =>
      run(`UPDATE core.export_artifact SET status = 'failed', failed_at = now(), failure = 'the suite' WHERE id = $1`, [exportId]));
    const after = await http().get(`/api/v1/reports/${reportId}`).set(admin.authorization).expect(200);
    expect(objectOf<{ exported: boolean }>(after.body).exported).toBe(false);
    await http().delete(`/api/v1/reports/${reportId}`).set(admin.authorization).expect(204);
  });
});
