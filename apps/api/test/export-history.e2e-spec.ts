import { createHash } from 'node:crypto';
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
import { EXPORT_FORMAT } from '../src/modules/core/export/constants/export.constants';
import { runExportAttempt } from '../src/modules/core/export/use-cases/run-export-attempt';
import { MEMBERSHIP_ROLE } from '../src/modules/identity/membership/models/membership.model';
import { asOrganization, connectAs, deleteNoticeWithdrawalsOf } from './support/database';
import { exportStorage, storageReader } from './support/export-files';
import { cleanupSignedInAccounts, signInFreshAccount, type SignedInAccount } from './support/signed-in-account';

const ORG = '01930000-0000-7000-8000-0000000000e7';
const EMAILS = { admin: 'oa@export-history.test', editor: 'rc@export-history.test', viewer: 'viewer@export-history.test' };
const CHISINAU = 'Europe/Chisinau';
const PDF = 'application/pdf';
const FILE = Buffer.from('%PDF-1.7 the file as it was sent');
const PROBLEM_BASE = 'https://easyesg.md/problems/';

interface ExportBody {
  id: string;
  reportId: string;
  format: string;
  locale: string;
  status: string;
  templateVersion: string;
  taxonomyVersion: string;
  requestedBy: { accountId: string; name: string | null };
}

/**
 * S-11's api end to end (tasks 47.1, 47.3, 47.4, 47.5; FR-41, FR-44, FR-49 … FR-53; §12.5.6's task-47 row): an export
 * asked for through its route — refused with its findings until they are acknowledged, the run it made kept — its
 * history and record read back, its file settled as the worker settles one and downloaded byte for byte, the person
 * who asked told when it took more than 30 s, the report marked filed across its period's lock, and every route
 * refused to a view-only member.
 *
 * **The file is settled by the job's own attempt** (`runExportAttempt`) with its real record store, object storage and
 * notification port, and a file made up rather than printed: the renderer is the PDF suite's to prove, and what this
 * suite proves is what happens around a file.
 */
describe('the export request, its history and the filed mark (task 47)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let worker: DataSource;
  let admin: SignedInAccount;
  let editor: SignedInAccount;
  let viewer: SignedInAccount;
  let periodId: string;
  let reportId: string;
  let earlierReportId: string;
  const files = storageReader();

  const http = () => request(app.getHttpServer());
  const objectOf = <T>(body: unknown): T => (body as { object: T }).object;
  const objectsOf = <T>(body: unknown): T[] => (body as { objects: T[] }).objects;
  const problemType = (response: request.Response): string => (response.body as { type: string }).type;

  /** One attempt of an export's job, as the worker runs it — the file made up, everything around it real. */
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

  const raisedNotices = () =>
    owner.query<{ payload: Record<string, unknown> }[]>(
      `SELECT payload FROM audit.outbox_event WHERE organization_id = $1 AND event_type = 'platform.notification.raised'`,
      [ORG],
    );

  const removeFixtures = async (): Promise<void> => {
    await owner.query(
      `DELETE FROM audit.outbox_event WHERE organization_id = $1 AND event_type IN ('export.pdf.requested', 'export.xlsx.requested', 'platform.notification.raised')`,
      [ORG],
    );
    await asOrganization(owner, ORG, (run) => run(`DELETE FROM core.organization WHERE id = $1`, [ORG]));
    await owner.query(`DELETE FROM identity.account WHERE email = ANY($1)`, [Object.values(EMAILS)]);
  };

  const openPeriodReport = async (entityId: string, fiscalYear: number) => {
    const period = await http().post('/api/v1/periods').set(admin.authorization).send({
      reportingEntityId: entityId,
      fiscalYear,
      periodStart: { date: `${fiscalYear}-01-01`, timezone: CHISINAU },
      periodEnd: { date: `${fiscalYear}-12-31`, timezone: CHISINAU },
    }).expect(201);
    const report = await http().post('/api/v1/reports').set(editor.authorization)
      .send({ reportingPeriodId: objectOf<{ id: string }>(period.body).id }).expect(201);
    return { periodId: objectOf<{ id: string }>(period.body).id, reportId: objectOf<{ id: string }>(report.body).id };
  };

  beforeAll(async () => {
    await initialiseCatalogue();
    @Module({ imports: [AppModule] })
    class TestAppModule {}
    app = await NestFactory.create<NestExpressApplication>(TestAppModule, { logger: false, abortOnError: false });
    configureHttpApp(app);
    await app.init();

    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-export-history-owner');
    worker = await connectAs('DB_WORKER_USER', 'DB_WORKER_PASSWORD', 'easyesg-export-history-worker');
    await removeFixtures();
    await files.removeOrganization(ORG);
    await asOrganization(owner, null, (run) =>
      run(`INSERT INTO core.organization (id, name, country_code) VALUES ($1, 'Brutăria Istoriei SRL', 'MD')`, [ORG]));
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
      name: 'Brutăria Istoriei', legalForm: 'srl', naceCodes: ['10.71'], idno: '1003600005148',
      sites: [{ name: 'Brutăria', locality: 'Chișinău', countryCode: 'MD' }],
    }).expect(201);
    const entityId = objectOf<{ id: string }>(entity.body).id;
    ({ periodId, reportId } = await openPeriodReport(entityId, 2026));
    ({ reportId: earlierReportId } = await openPeriodReport(entityId, 2025));
  }, 120_000);

  afterAll(async () => {
    await deleteNoticeWithdrawalsOf({ owner, organizationIds: [ORG] });
    await cleanupSignedInAccounts({ owner });
    await files.removeOrganization(ORG);
    files.client.destroy();
    await removeFixtures();
    await app?.close();
    for (const source of [owner, worker]) if (source?.isInitialized) await source.destroy();
  });

  it('refuses an export of a report with unresolved findings, listing them, and keeps the run it made (FR-44; 182/20; row (7))', async () => {
    const refused = await http().post(`/api/v1/reports/${reportId}/exports`).set(editor.authorization)
      .send({ format: EXPORT_FORMAT.PDF, locale: 'ro' }).expect(409);
    expect(problemType(refused)).toBe(`${PROBLEM_BASE}export-findings-unacknowledged`);
    const { findings } = refused.body as { findings: { field: { elementKey: string; label: string | null } }[] };
    expect(findings.length).toBeGreaterThan(0);
    // Named as S-08 names them: a label to read, never the element key alone.
    expect(findings.every((finding) => typeof finding.field.label === 'string')).toBe(true);

    // Nothing of the export was written — and the run the request made is the report's now.
    const history = await http().get(`/api/v1/reports/${reportId}/exports`).set(editor.authorization).expect(200);
    expect((history.body as { unfiltered: number }).unfiltered).toBe(0);
    const validation = await http().get(`/api/v1/reports/${reportId}/validation`).set(editor.authorization).expect(200);
    expect(objectOf<{ run: unknown; findings: unknown[] }>(validation.body).findings).toHaveLength(findings.length);
  });

  it('queues the acknowledged request: 202, the export requested at the report’s pin, and its job keyed by its id (47.4)', async () => {
    const queued = await http().post(`/api/v1/reports/${reportId}/exports`).set(editor.authorization)
      .send({ format: EXPORT_FORMAT.PDF, locale: 'ro', acknowledgeUnresolvedFindings: true }).expect(202);
    const exported = objectOf<ExportBody>(queued.body);
    expect(exported).toMatchObject({
      reportId,
      format: EXPORT_FORMAT.PDF,
      locale: 'ro',
      status: 'requested',
      templateVersion: '1.3.0',
      taxonomyVersion: '2026-05-01',
      requestedBy: { accountId: editor.accountId },
    });
    const jobs = await owner.query<{ event_type: string; payload: { exportId: string } }[]>(
      `SELECT event_type, payload FROM audit.outbox_event WHERE organization_id = $1 AND idempotency_key = $2`,
      [ORG, exported.id],
    );
    expect(jobs).toEqual([{ event_type: 'export.pdf.requested', payload: { exportId: exported.id } }]);

    // The record is watched while the job runs, and its file is not there yet.
    const watched = await http().get(`/api/v1/exports/${exported.id}`).set(editor.authorization).expect(200);
    expect(objectOf<ExportBody>(watched.body).status).toBe('requested');
    const early = await http().get(`/api/v1/exports/${exported.id}/file`).set(editor.authorization).expect(409);
    expect(problemType(early)).toBe(`${PROBLEM_BASE}export-file-unavailable`);

    // The report's status is the lock's and the run's, never the export's (182/19).
    const report = await http().get(`/api/v1/reports/${reportId}`).set(editor.authorization).expect(200);
    expect(objectOf<{ status: string }>(report.body).status).toBe('open');
  });

  it('refuses a report to be marked filed before an export of it has completed (row (4))', async () => {
    const refused = await http().put(`/api/v1/reports/${reportId}/filing`).set(editor.authorization)
      .send({ filedOn: '2026-10-09' }).expect(409);
    expect(problemType(refused)).toBe(`${PROBLEM_BASE}report-not-exported`);
  });

  it('serves the stored file byte for byte once settled, and tells the person who asked when it took over 30 s (47.1, 47.3)', async () => {
    const queued = await http().post(`/api/v1/reports/${reportId}/exports`).set(admin.authorization)
      .send({ format: EXPORT_FORMAT.PDF, locale: 'en', acknowledgeUnresolvedFindings: true }).expect(202);
    const exportId = objectOf<ExportBody>(queued.body).id;
    // Asked for two minutes ago, as a slow render would have been.
    await asOrganization(owner, ORG, (run) =>
      run(`UPDATE core.export_artifact SET requested_at = now() - interval '2 minutes' WHERE id = $1`, [exportId]));
    await settle(exportId);

    const download = await http().get(`/api/v1/exports/${exportId}/file`).set(editor.authorization)
      .buffer(true).parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      }).expect(200);
    expect(download.headers['content-type']).toBe(PDF);
    expect(download.headers['content-disposition']).toContain("filename*=UTF-8''Brut%C4%83ria%20Istoriei%20VSME%202026%20en.pdf");
    expect(createHash('sha256').update(download.body as Buffer).digest('hex')).toBe(createHash('sha256').update(FILE).digest('hex'));

    const notices = await raisedNotices();
    expect(notices.map(({ payload }) => payload)).toEqual([
      expect.objectContaining({
        categoryKey: 'reporting.export_finished',
        recipientUserIds: [admin.accountId],
        deepLink: `/reports/${reportId}/export`,
        params: { entityName: 'Brutăria Istoriei', fiscalYear: '2026', format: EXPORT_FORMAT.PDF, outcome: 'completed' },
      }),
    ]);
  });

  it('lists every export of the report, newest first, filtered by format, language and status (47.1; UX-49; row (n))', async () => {
    const all = await http().get(`/api/v1/reports/${reportId}/exports`).set(editor.authorization).expect(200);
    const listed = objectsOf<ExportBody>(all.body).map((row) => [row.locale, row.status]);
    // The English one was asked for two minutes ago (the notice's case), so it is the older.
    expect(listed).toEqual([['ro', 'requested'], ['en', 'completed']]);
    expect(all.body).toMatchObject({ total: 2, unfiltered: 2 });

    const english = await http().get(`/api/v1/reports/${reportId}/exports?filters=language,en`).set(editor.authorization).expect(200);
    expect(english.body).toMatchObject({ total: 1, unfiltered: 2 });
    const excel = await http().get(`/api/v1/reports/${reportId}/exports?filters=format,xlsx`).set(editor.authorization).expect(200);
    expect(excel.body).toMatchObject({ objects: [], total: 0, unfiltered: 2 });
    // What S-11 asks of the whole history before it offers the mark: is any export of the report complete?
    const completed = await http().get(`/api/v1/reports/${reportId}/exports?filters=status,completed&onpage=1`)
      .set(editor.authorization).expect(200);
    expect(completed.body).toMatchObject({ total: 1, unfiltered: 2 });
    expect(objectsOf<ExportBody>(completed.body).map((row) => row.locale)).toEqual(['en']);
  });

  it('marks the report filed, keeps the mark across the period’s lock, and withdraws it (47.5; rows (1)–(3))', async () => {
    const marked = await http().put(`/api/v1/reports/${reportId}/filing`).set(editor.authorization)
      .send({ filedOn: '2026-10-09' }).expect(200);
    expect(objectOf<{ status: string; locked: boolean; filing: unknown }>(marked.body)).toMatchObject({
      status: 'filed',
      locked: false,
      filing: { filedOn: { date: '2026-10-09', timezone: CHISINAU }, filedBy: { accountId: editor.accountId } },
    });

    await http().post(`/api/v1/periods/${periodId}/lock`).set(admin.authorization).expect(200);
    const locked = await http().get(`/api/v1/reports/${reportId}`).set(viewer.authorization).expect(200);
    // Filed reads over the lock, so the lock is said beside it — what keeps every screen read-only (row (o)).
    expect(objectOf<{ status: string; locked: boolean }>(locked.body)).toMatchObject({ status: 'filed', locked: true });

    // A locked report is unmarked and marked like an open one; the lock alone freezes its content.
    const withdrawn = await http().delete(`/api/v1/reports/${reportId}/filing`).set(admin.authorization).expect(200);
    expect(objectOf<{ status: string; filing: unknown }>(withdrawn.body)).toMatchObject({ status: 'locked', filing: null });
    await http().put(`/api/v1/reports/${reportId}/filing`).set(admin.authorization).send({ filedOn: '2026-10-10' }).expect(200);
    await http().patch(`/api/v1/reports/${reportId}`).set(editor.authorization).send({ scope: 'basic_and_comprehensive' }).expect(409);

    const refused = await http().put(`/api/v1/reports/${reportId}/filing`).set(editor.authorization).send({ filedOn: '2026-02-30' }).expect(400);
    expect(problemType(refused)).toBe(`${PROBLEM_BASE}validation-failed`);
  });

  it('says which versions supersede a report’s pin, and none for a current one (FR-51; row (6))', async () => {
    const current = await http().get(`/api/v1/reports/${reportId}`).set(editor.authorization).expect(200);
    expect(objectOf<{ supersededBy: unknown }>(current.body).supersededBy).toBeNull();
    const earlier = await http().get(`/api/v1/reports/${earlierReportId}`).set(editor.authorization).expect(200);
    expect(objectOf<{ taxonomyVersion: string; supersededBy: unknown }>(earlier.body)).toMatchObject({
      taxonomyVersion: '2026-02-01',
      supersededBy: { taxonomyVersion: '2026-05-01', templateVersion: '1.3.0' },
    });
  });

  it('names the languages a file may be written in, and which carry EFRAG’s own labels at the pin (UX-47; row (k))', async () => {
    const read = await http().get(`/api/v1/reports/${reportId}/exports/languages`).set(editor.authorization).expect(200);
    // At `2026-05-01` EFRAG publishes English alone; Romanian and Russian are the platform's (T-14).
    expect(objectOf<{ languages: unknown[] }>(read.body).languages).toEqual([
      { locale: 'ro', labelStanding: 'platform_authored' },
      { locale: 'en', labelStanding: 'official' },
      { locale: 'ru', labelStanding: 'platform_authored' },
    ]);
  });

  it('refuses a view-only member every export route and the mark (182/22)', async () => {
    const [anExport] = objectsOf<ExportBody>(
      (await http().get(`/api/v1/reports/${reportId}/exports`).set(editor.authorization).expect(200)).body,
    );
    // Each request made when it is sent: a supertest request binds its server when it is built.
    const calls = [
      () => http().post(`/api/v1/reports/${reportId}/exports`).set(viewer.authorization).send({ format: EXPORT_FORMAT.PDF, locale: 'ro' }),
      () => http().get(`/api/v1/reports/${reportId}/exports`).set(viewer.authorization),
      () => http().get(`/api/v1/reports/${reportId}/exports/languages`).set(viewer.authorization),
      () => http().get(`/api/v1/exports/${anExport.id}`).set(viewer.authorization),
      () => http().get(`/api/v1/exports/${anExport.id}/file`).set(viewer.authorization),
      () => http().put(`/api/v1/reports/${reportId}/filing`).set(viewer.authorization).send({ filedOn: '2026-10-09' }),
      () => http().delete(`/api/v1/reports/${reportId}/filing`).set(viewer.authorization),
    ];
    for (const call of calls) {
      const refused = await call().expect(403);
      expect(problemType(refused)).toBe(`${PROBLEM_BASE}insufficient-role`);
    }
  });
});
