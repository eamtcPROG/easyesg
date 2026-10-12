import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { NOTIFICATION_PORT, type NotificationPort } from '../src/contracts/notification.port';
import { ExportArtifactStoreRepository } from '../src/infrastructure/persistence/core/export-artifact-store.repository';
import { WorkerTenantWork } from '../src/infrastructure/persistence/worker-tenant-work';
import { configureHttpApp } from '../src/main.http';
import { DISCLOSURE_STATE } from '../src/modules/core/disclosure/models/disclosure-value.model';
import { EXPORT_FORMAT } from '../src/modules/core/export/constants/export.constants';
import { runExportAttempt } from '../src/modules/core/export/use-cases/run-export-attempt';
import { MEMBERSHIP_ROLE } from '../src/modules/identity/membership/models/membership.model';
import { asOrganization, connectAs, deleteNoticeWithdrawalsOf } from './support/database';
import { exportStorage } from './support/export-files';
import { cleanupSignedInAccounts, signInFreshAccount, type SignedInAccount } from './support/signed-in-account';

const ORG = '01930000-0000-7000-8000-000000000214';
const EMAILS = { admin: 'oa@archived-report.test', editor: 'rc@archived-report.test' };
const CHISINAU = 'Europe/Chisinau';
const PROBLEM_BASE = 'https://easyesg.md/problems/';
const FILE = Buffer.from('%PDF-1.7 an archived entity’s last report');

/**
 * FR-20's behaviour 7 end to end (task 214; `architecture.md` §12.5.6's task-214 row): a report opened before its entity
 * was archived takes **no write to what it answers** — values, derivation inputs, a calculator line, its scope — each
 * refused 409 `entity-archived` **by the database**, since no use case checks the archive and the code is the guard's;
 * it **still accepts a check, an export and the filed mark**; its **deletion and a reminder about it are refused**; the
 * archive is named **over a lock**; and an organization holding such a report is still removed whole.
 */
describe('a report on an archived entity (task 214)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let worker: DataSource;
  let admin: SignedInAccount;
  let editor: SignedInAccount;

  const http = () => request(app.getHttpServer());
  const objectOf = <T>(body: unknown): T => (body as { object: T }).object;
  const problemType = (response: request.Response): string => (response.body as { type: string }).type;
  const ARCHIVED = `${PROBLEM_BASE}entity-archived`;

  const removeFixtures = async (): Promise<void> => {
    await owner.query(`DELETE FROM audit.outbox_event WHERE organization_id = $1`, [ORG]);
    await asOrganization(owner, ORG, (run) => run(`DELETE FROM core.organization WHERE id = $1`, [ORG]));
    await owner.query(`DELETE FROM identity.account WHERE email = ANY($1)`, [Object.values(EMAILS)]);
  };

  const storedTurnover = async (reportId: string): Promise<string | null> => {
    const rows = (await asOrganization(owner, ORG, (run) =>
      run(
        `SELECT value_numeric::text AS value FROM core.report_disclosure_value
          WHERE report_id = $1 AND element_key = 'Turnover'`,
        [reportId],
      ))) as { value: string | null }[];
    return rows[0]?.value ?? null;
  };

  /** A report under way — its turnover answered and a calculator line kept — on an entity then archived. */
  const archivedReport = async (): Promise<{ entityId: string; periodId: string; reportId: string }> => {
    const entity = await http().post('/api/v1/entities').set(admin.authorization).send({
      name: `Fabrica Vândută ${randomUUID().slice(0, 8)}`, legalForm: 'srl', naceCodes: ['10.71'], idno: '1003600005148',
      sites: [{ name: 'Fabrica', locality: 'Chișinău', countryCode: 'MD' }],
    }).expect(201);
    const entityId = objectOf<{ id: string }>(entity.body).id;
    const period = await http().post('/api/v1/periods').set(admin.authorization).send({
      reportingEntityId: entityId,
      fiscalYear: 2026,
      periodStart: { date: '2026-01-01', timezone: CHISINAU },
      periodEnd: { date: '2026-12-31', timezone: CHISINAU },
    }).expect(201);
    const periodId = objectOf<{ id: string }>(period.body).id;
    const report = await http().post('/api/v1/reports').set(editor.authorization).send({ reportingPeriodId: periodId }).expect(201);
    const reportId = objectOf<{ id: string }>(report.body).id;
    await http().put(`/api/v1/reports/${reportId}/values`).set(editor.authorization)
      .send({ values: [{ elementKey: 'Turnover', valueNumeric: '1250000', state: DISCLOSURE_STATE.OK }] }).expect(200);

    await http().post(`/api/v1/entities/${entityId}/archive`).set(admin.authorization).send({}).expect(204);
    return { entityId, periodId, reportId };
  };

  const settle = (exportId: string) =>
    runExportAttempt({
      command: { organizationId: ORG, exportId, attempt: 1, attempts: 3 },
      format: EXPORT_FORMAT.PDF,
      tenantWork: new WorkerTenantWork(worker),
      store: new ExportArtifactStoreRepository(),
      storage: exportStorage(),
      notifications: app.get<NotificationPort>(NOTIFICATION_PORT, { strict: false }),
      now: () => new Date(),
      compose: () => Promise.resolve(null),
      produce: () => Promise.resolve(new Uint8Array(FILE)),
    });

  beforeAll(async () => {
    await initialiseCatalogue();
    @Module({ imports: [AppModule] })
    class TestAppModule {}
    app = await NestFactory.create<NestExpressApplication>(TestAppModule, { logger: false, abortOnError: false });
    configureHttpApp(app);
    await app.init();

    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-archived-report-owner');
    worker = await connectAs('DB_WORKER_USER', 'DB_WORKER_PASSWORD', 'easyesg-archived-report-worker');
    await removeFixtures();
    await asOrganization(owner, null, (run) =>
      run(`INSERT INTO core.organization (id, name, country_code) VALUES ($1, 'Grupul Arhivat SRL', 'MD')`, [ORG]));
    const server = app.getHttpServer();
    admin = await signInFreshAccount({ server, worker, email: EMAILS.admin });
    editor = await signInFreshAccount({ server, worker, email: EMAILS.editor });
    for (const [account, role] of [
      [admin, MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR],
      [editor, MEMBERSHIP_ROLE.EDITOR],
    ] as const) {
      await asOrganization(owner, ORG, (run) =>
        run(`INSERT INTO identity.membership (account_id, organization_id, role) VALUES ($1,$2,$3)`, [account.accountId, ORG, role]));
    }
  }, 120_000);

  afterAll(async () => {
    await deleteNoticeWithdrawalsOf({ owner, organizationIds: [ORG] });
    await cleanupSignedInAccounts({ owner });
    await removeFixtures();
    await app?.close();
    for (const source of [owner, worker]) if (source?.isInitialized) await source.destroy();
  });

  it('says its entity is archived, on the report a screen reads', async () => {
    const { reportId } = await archivedReport();
    const read = await http().get(`/api/v1/reports/${reportId}`).set(editor.authorization).expect(200);
    expect(objectOf<{ subject: { entityStatus: string } }>(read.body).subject.entityStatus).toBe('archived');
  });

  it('refuses every write to what it answers with entity-archived, storing nothing — the database’s refusal (AC-9)', async () => {
    const { reportId } = await archivedReport();
    const refusals = [
      await http().put(`/api/v1/reports/${reportId}/values`).set(editor.authorization)
        .send({ values: [{ elementKey: 'Turnover', valueNumeric: '999', state: DISCLOSURE_STATE.OK }] }),
      await http().put(`/api/v1/reports/${reportId}/derivation-inputs`).set(editor.authorization)
        .send({ values: [{ inputKey: 'NumberOfEmployeesWhoLeftDuringTheReportingPeriod', valueNumeric: '3' }] }),
      await http().put(`/api/v1/reports/${reportId}/calculator/sources/${randomUUID()}`).set(editor.authorization)
        .send({ siteOrdinal: 0, sourceKey: 'natural_gas', description: 'Oven', quantity: '500', unitCode: 'm3' }),
      await http().patch(`/api/v1/reports/${reportId}`).set(editor.authorization).send({ scope: 'basic_and_comprehensive' }),
    ];
    expect(refusals.map((response) => [response.status, problemType(response)])).toEqual(
      refusals.map(() => [409, ARCHIVED]),
    );
    expect(await storedTurnover(reportId)).toBe('1250000');
  });

  it('still takes a check, an export and the filed mark, so its last report can be filed as it stands (AC-10)', async () => {
    const { reportId } = await archivedReport();
    await http().post(`/api/v1/reports/${reportId}/validation/runs`).set(editor.authorization).expect(201);

    const queued = await http().post(`/api/v1/reports/${reportId}/exports`).set(editor.authorization)
      .send({ format: EXPORT_FORMAT.PDF, locale: 'ro', acknowledgeUnresolvedFindings: true }).expect(202);
    await settle(objectOf<{ id: string }>(queued.body).id);

    const marked = await http().put(`/api/v1/reports/${reportId}/filing`).set(editor.authorization)
      .send({ filedOn: '2026-10-12' }).expect(200);
    expect(objectOf<{ status: string }>(marked.body).status).toBe('filed');
  });

  it('refuses its deletion — the archive retains it — and a reminder nobody could act on (AC-10; FR-173)', async () => {
    const { reportId } = await archivedReport();
    const deletion = await http().delete(`/api/v1/reports/${reportId}`).set(admin.authorization).expect(409);
    expect(problemType(deletion)).toBe(ARCHIVED);

    const [membership] = (await asOrganization(owner, ORG, (run) =>
      run(`SELECT id FROM identity.membership WHERE account_id = $1`, [editor.accountId]))) as { id: string }[];
    const reminder = await http().post(`/api/v1/reports/${reportId}/reminders`).set(admin.authorization)
      .send({ membershipId: membership?.id });
    expect(reminder.status).toBe(409);
    expect(problemType(reminder)).toBe(`${PROBLEM_BASE}conflict`);
  });

  it('names the archive over its period’s lock, which reopening could not undo (row (a)); the lock stays the period’s (row (b))', async () => {
    const { periodId, reportId } = await archivedReport();
    await http().post(`/api/v1/periods/${periodId}/lock`).set(admin.authorization).expect(200);

    const refused = await http().put(`/api/v1/reports/${reportId}/values`).set(editor.authorization)
      .send({ values: [{ elementKey: 'Turnover', valueNumeric: '999', state: DISCLOSURE_STATE.OK }] }).expect(409);
    expect(problemType(refused)).toBe(ARCHIVED);
    // And its deletion likewise names the archive, not the lock.
    expect(problemType(await http().delete(`/api/v1/reports/${reportId}`).set(admin.authorization).expect(409))).toBe(
      ARCHIVED,
    );
  });

  it('leaves the organization removable whole, its archived entity’s report and answers with it (row (c))', async () => {
    const { reportId } = await archivedReport();
    expect(await storedTurnover(reportId)).toBe('1250000');

    // The cascade reaches the values after their report and its entity have gone, so the guard reads nothing to refuse.
    await owner.query(`DELETE FROM audit.outbox_event WHERE organization_id = $1`, [ORG]);
    await asOrganization(owner, ORG, (run) => run(`DELETE FROM core.organization WHERE id = $1`, [ORG]));
    expect(await storedTurnover(reportId)).toBeNull();
  });
});
