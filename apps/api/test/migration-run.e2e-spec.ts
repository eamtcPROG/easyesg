import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { ProblemType, problemTypeUri } from '../src/app/filters/problem-types';
import { ReportMigrationsRepository } from '../src/infrastructure/persistence/core/report-migrations.repository';
import { MigrationRunDirectoryRepository } from '../src/infrastructure/persistence/platform/migration-run-directory.repository';
import { NotificationOutboxRepository } from '../src/infrastructure/persistence/platform/notification-outbox.repository';
import { WorkerTenantWork } from '../src/infrastructure/persistence/worker-tenant-work';
import { configureHttpApp } from '../src/main.http';
import { DISCLOSURE_STATE } from '../src/modules/core/disclosure/models/disclosure-value.model';
import { ADMIN_ROLE } from '../src/modules/platform/admin/models/admin-session.model';
import { CONSOLE_ROLE } from '../src/modules/platform/admin/models/console-role.model';
import { MigrationRunRequestedHandler } from '../src/modules/platform/taxonomy/consumers/migration-run-requested.handler';
import { MigrationRunRevertedHandler } from '../src/modules/platform/taxonomy/consumers/migration-run-reverted.handler';
import { ExecuteMigrationRun } from '../src/modules/platform/taxonomy/use-cases/execute-migration-run.use-case';
import { RevertMigrationRunReports } from '../src/modules/platform/taxonomy/use-cases/revert-migration-run-reports.use-case';
import { asOrganization, connectAs } from './support/database';
import { openReport } from './support/opened-report';
import { cleanupSignedInAccounts, signInFreshAccount, type SignedInAccount } from './support/signed-in-account';
import {
  ADMIN_ORIGIN,
  cleanupSignedInOperators,
  signInOperator,
  type SignedInOperator,
} from './support/signed-in-operator';

/**
 * A taxonomy migration run, started on A-04 and executed by the worker (tasks 67.23, 67.24; UC-78; FR-69, FR-70;
 * 182/41 … 182/43; §12.5.6's task-67.23 and task-67.24 rows).
 *
 * What only this suite can prove: that the start returns before any report moves and leaves the job queued with it;
 * that the worker, as `esg_worker` with row security bound per report, moves a report's two pins and keeps what it was
 * — and leaves a locked period's report where it is; that the console reads the run's progress per organization as
 * counts; that a revert puts the retained answers back and withdraws the notices; and that a breaking pair holds each
 * report for its Organization Administrator rather than putting it in force.
 *
 * **The worker's half runs in this process**, as `factor-set-notice.e2e-spec.ts` runs its handler: the handlers built
 * over the worker's own role, handed the job the request tier queued. Its organizations are founded over HTTP with
 * periods starting in 2025, which pins `2026-02-01` (`reporting-taxonomy.vsme.json`), and every run names them, so a
 * report another suite left on that version is never selected.
 */
const RUN = `${process.pid}-${Date.now()}`;
const FROM = '2026-02-01';
const TO = '2026-05-01';
const PAIR_SCOPE = `${FROM}_${TO}`;

interface Opened {
  readonly organizationId: string;
  readonly periodId: string;
  readonly reportId: string;
}

describe('a taxonomy migration run (tasks 67.23, 67.24)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let application: DataSource;
  let worker: DataSource;
  let analyst: DataSource;
  let operator: SignedInOperator;
  let alphaAdmin: SignedInAccount;
  let betaAdmin: SignedInAccount;
  let alpha: Opened;
  let beta: Opened;
  let lockedReport: string;
  let mappingBefore: { id: string; revision: number } | null = null;
  const runIds: string[] = [];

  const http = () => request(app.getHttpServer());
  const asOperator = (call: request.Test) => call.set(operator.cookie).set('origin', ADMIN_ORIGIN);
  const runBody = (extra: Record<string, unknown> = {}) => ({
    from: FROM,
    to: TO,
    toTemplateVersion: '1.3.0',
    organizationIds: [alpha.organizationId, beta.organizationId],
    ...extra,
  });
  const start = async (extra: Record<string, unknown> = {}): Promise<string> => {
    const started = await asOperator(http().post('/api/v1/admin/taxonomy/migration-runs')).send(runBody(extra)).expect(201);
    const { id } = (started.body as { object: { id: string } }).object;
    runIds.push(id);
    return id;
  };
  const readRun = async (id: string) =>
    (
      (await asOperator(http().get(`/api/v1/admin/taxonomy/migration-runs/${id}`)).expect(200)).body as {
        object: {
          pending: number;
          revertedAt: number | null;
          tally: { status: string; reports: number }[];
          organizations: { organizationId: string; name: string; selected: number; pending: number }[];
        };
      }
    ).object;
  const counted = (tally: { status: string; reports: number }[]) =>
    Object.fromEntries(tally.filter((entry) => entry.reports > 0).map((entry) => [entry.status, entry.reports]));

  /** The worker's two handlers over its own role — what `MODE=worker` registers, handed the job's payload. */
  const migrations = () =>
    [new MigrationRunDirectoryRepository(worker), new ReportMigrationsRepository(), new WorkerTenantWork(worker), new NotificationOutboxRepository()] as const;
  const execute = (runId: string) => new MigrationRunRequestedHandler(new ExecuteMigrationRun(...migrations())).handle({ runId });
  const revert = (runId: string) => new MigrationRunRevertedHandler(new RevertMigrationRunReports(...migrations())).handle({ runId });

  const pinsOf = (report: Opened) =>
    asOrganization(owner, report.organizationId, async (run) => {
      const [row] = (await run(`SELECT taxonomy_version, template_version FROM core.report WHERE id = $1`, [report.reportId])) as {
        taxonomy_version: string;
        template_version: string;
      }[];
      return `${row.taxonomy_version}/${row.template_version}`;
    });
  const turnoverOf = (report: Opened) =>
    asOrganization(owner, report.organizationId, async (run) => {
      const rows = (await run(
        `SELECT value_numeric::text AS value FROM core.report_disclosure_value WHERE report_id = $1 AND element_key = 'Turnover'`,
        [report.reportId],
      )) as { value: string }[];
      return rows[0]?.value ?? null;
    });
  const writeTurnover = (report: Opened, administrator: SignedInAccount, value: string) =>
    http()
      .put(`/api/v1/reports/${report.reportId}/values`)
      .set(administrator.authorization)
      .send({ values: [{ elementKey: 'Turnover', valueNumeric: value, state: DISCLOSURE_STATE.OK }] })
      .expect(200);
  const migrationRows = (report: Opened) =>
    asOrganization(owner, report.organizationId, (run) =>
      run(`SELECT run_id, status, prior_values FROM core.report_migration WHERE report_id = $1 ORDER BY migrated_at`, [report.reportId]),
    ) as Promise<{ run_id: string; status: string; prior_values: { element_key: string; value_numeric: string }[] }[]>;
  const reportUpdates = (eventType: string, organizationId: string) =>
    worker.query<{ payload: Record<string, unknown> }[]>(
      `SELECT payload FROM audit.outbox_event
        WHERE event_type = $1 AND organization_id = $2 AND payload->>'categoryKey' = 'reporting.report_update'
        ORDER BY occurred_at`,
      [eventType, organizationId],
    );

  beforeAll(async () => {
    await initialiseCatalogue();
    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
    configureHttpApp(app);
    await app.init();
    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-migration-run-owner');
    application = await connectAs('DB_USER', 'DB_PASSWORD', 'easyesg-migration-run-app');
    worker = await connectAs('DB_WORKER_USER', 'DB_WORKER_PASSWORD', 'easyesg-migration-run-worker');
    analyst = await connectAs('DB_ADMIN_RO_USER', 'DB_ADMIN_RO_PASSWORD', 'easyesg-migration-run-analyst');

    const server = app.getHttpServer();
    operator = await signInOperator({
      server,
      application,
      email: `migration-pa-${RUN}@easyesg.md`,
      role: ADMIN_ROLE.PLATFORM_ADMINISTRATOR,
      consoleRoles: [CONSOLE_ROLE.OPERATIONS],
    });
    alphaAdmin = await signInFreshAccount({ server, worker, email: `migration-alpha-${RUN}@migration.test` });
    betaAdmin = await signInFreshAccount({ server, worker, email: `migration-beta-${RUN}@migration.test` });
    alpha = await openReport({ server, administrator: alphaAdmin, name: `Migrare Alfa ${RUN}`, fiscalYear: 2025 });
    beta = await openReport({ server, administrator: betaAdmin, name: `Migrare Beta ${RUN}`, fiscalYear: 2025 });

    // A second, locked period in Alpha: on the run's version, and read-only, so a run leaves it out.
    const entities = await http().get('/api/v1/entities').set(alphaAdmin.authorization).expect(200);
    const [entity] = (entities.body as { objects: { id: string }[] }).objects;
    const period = await http()
      .post('/api/v1/periods')
      .set(alphaAdmin.authorization)
      .send({
        reportingEntityId: entity.id,
        fiscalYear: 2024,
        periodStart: { date: '2024-01-01', timezone: 'Europe/Chisinau' },
        periodEnd: { date: '2024-12-31', timezone: 'Europe/Chisinau' },
      })
      .expect(201);
    const lockedPeriod = (period.body as { object: { id: string } }).object.id;
    const report = await http().post('/api/v1/reports').set(alphaAdmin.authorization).send({ reportingPeriodId: lockedPeriod }).expect(201);
    lockedReport = (report.body as { object: { id: string } }).object.id;
    await http().post(`/api/v1/periods/${lockedPeriod}/lock`).set(alphaAdmin.authorization).expect(200);

    await writeTurnover(alpha, alphaAdmin, '1000');

    const [mapping] = await owner.query<{ id: string; revision: number }[]>(
      `SELECT v.id, v.revision FROM config.entry_schedule s JOIN config.entry_version v ON v.id = s.version_id
        WHERE s.kind = 'vsme_taxonomy_mapping' AND s.scope = $1`,
      [PAIR_SCOPE],
    );
    mappingBefore = mapping ?? null;
  }, 180_000);

  afterAll(async () => {
    if (owner?.isInitialized) {
      if (mappingBefore !== null) {
        // The mapping this suite republished, put back on the version it found — around the trigger, as every store suite.
        await owner.query(`ALTER TABLE config.entry_version DISABLE TRIGGER reject_published_edit`);
        await owner.query(`UPDATE config.entry_schedule SET version_id = $1 WHERE kind = 'vsme_taxonomy_mapping' AND scope = $2`, [
          mappingBefore.id,
          PAIR_SCOPE,
        ]);
        await owner.query(`UPDATE config.entry_version SET state = 'published' WHERE id = $1`, [mappingBefore.id]);
        await owner.query(`DELETE FROM config.entry_version WHERE kind = 'vsme_taxonomy_mapping' AND scope = $1 AND revision > $2`, [
          PAIR_SCOPE,
          mappingBefore.revision,
        ]);
        await owner.query(`ALTER TABLE config.entry_version ENABLE TRIGGER reject_published_edit`);
      }
      const organizations = [alpha?.organizationId, beta?.organizationId].filter((id): id is string => id !== undefined);
      await owner.query(
        `DELETE FROM audit.outbox_event
          WHERE organization_id = ANY($1::uuid[]) OR (organization_id IS NULL AND payload->>'runId' = ANY($2::text[]))`,
        [organizations, runIds],
      );
      await owner.query(`DELETE FROM config.migration_run WHERE id = ANY($1::uuid[])`, [runIds]);
      for (const organizationId of organizations) {
        await asOrganization(owner, organizationId, (run) => run(`DELETE FROM core.organization WHERE id = $1`, [organizationId]));
      }
    }
    await cleanupSignedInOperators({ owner });
    await cleanupSignedInAccounts({ owner });
    await app?.close();
    for (const source of [owner, application, worker, analyst]) {
      if (source?.isInitialized) await source.destroy();
    }
  });

  it('previews the blast radius: the determination, the reports and organizations reached, and what it leaves out', async () => {
    const preview = await asOperator(http().post('/api/v1/admin/taxonomy/migration-runs/preview')).send(runBody()).expect(200);
    expect((preview.body as { object: unknown }).object).toEqual({
      determination: 'compatible',
      reports: 2,
      organizations: 2,
      leftOut: 1,
    });
  });

  it('refuses a template not registered against the version, a pair with no mapping, and a run that selects nothing', async () => {
    const preview = (body: Record<string, unknown>) =>
      asOperator(http().post('/api/v1/admin/taxonomy/migration-runs/preview')).send(runBody(body));
    await preview({ toTemplateVersion: '1.2.0' }).expect(404);
    const unmapped = await preview({ from: TO, to: FROM, toTemplateVersion: '1.2.0' }).expect(409);
    expect((unmapped.body as { type: string }).type).toBe(problemTypeUri(ProblemType.Conflict));
    await asOperator(http().post('/api/v1/admin/taxonomy/migration-runs')).send(runBody({ organizationIds: [randomUUID()] })).expect(409);
  });

  it('starts a run that returns at once — queued, logged, and nothing moved yet', async () => {
    const runId = await start();

    expect(await pinsOf(alpha)).toBe(`${FROM}/1.2.0`);
    const queued = await worker.query<{ idempotency_key: string }[]>(
      `SELECT idempotency_key FROM audit.outbox_event WHERE event_type = 'taxonomy.migration_run.requested' AND payload->>'runId' = $1`,
      [runId],
    );
    expect(queued.map((row) => row.idempotency_key)).toEqual([`migration-run/${runId}`]);
    const logged = await analyst.query<{ target_id: string }[]>(
      `SELECT target_id FROM audit.system_audit_log WHERE action = 'admin.taxonomy.migration_run_started' AND actor_id = $1`,
      [operator.accountId],
    );
    expect(logged.map((row) => row.target_id)).toEqual([runId]);

    const read = await readRun(runId);
    expect(read.pending).toBe(2);
    expect(counted(read.tally)).toEqual({});
  });

  it('moves each report on the worker, keeps what it was, leaves the locked one, and tells each organization', async () => {
    const [runId] = runIds;
    await execute(runId);

    expect(await pinsOf(alpha)).toBe(`${TO}/1.3.0`);
    expect(await pinsOf(beta)).toBe(`${TO}/1.3.0`);
    expect(await pinsOf({ ...alpha, reportId: lockedReport })).toBe(`${FROM}/1.2.0`);
    const [kept] = await migrationRows(alpha);
    expect(kept).toMatchObject({ run_id: runId, status: 'migrated' });
    expect(kept.prior_values.find((value) => value.element_key === 'Turnover')?.value_numeric).toBe(1000);
    // Moving a report changes no answer.
    expect(await turnoverOf(alpha)).toBe('1000');

    const [notice] = await reportUpdates('platform.notification.raised', alpha.organizationId);
    expect(notice.payload).toMatchObject({
      subjectRef: `migration-run/${runId}`,
      deepLink: `/reports/${alpha.reportId}`,
      recipientUserIds: [alphaAdmin.accountId],
      params: { cause: 'migrated', reach: 'one', version: TO, fiscalYear: '2025' },
    });
    expect(await reportUpdates('platform.notification.raised', beta.organizationId)).toHaveLength(1);

    const read = await readRun(runId);
    expect(read.pending).toBe(0);
    expect(counted(read.tally)).toEqual({ migrated: 2 });
    expect(read.organizations.map(({ name, selected, pending }) => ({ name, selected, pending })).sort((a, b) => a.name.localeCompare(b.name))).toEqual([
      { name: `Migrare Alfa ${RUN}`, selected: 1, pending: 0 },
      { name: `Migrare Beta ${RUN}`, selected: 1, pending: 0 },
    ]);

    // The same job again — a redelivery — moves nothing twice.
    await execute(runId);
    expect(await migrationRows(alpha)).toHaveLength(1);
  });

  it('refuses a retry where nothing failed', async () => {
    const refused = await asOperator(http().post(`/api/v1/admin/taxonomy/migration-runs/${runIds[0]}/retry`)).expect(409);
    expect((refused.body as { type: string }).type).toBe(problemTypeUri(ProblemType.Conflict));
  });

  it('reverts the run: the retained answers and pins put back, the notices withdrawn, once', async () => {
    const [runId] = runIds;
    await writeTurnover(alpha, alphaAdmin, '2000');

    await asOperator(http().post(`/api/v1/admin/taxonomy/migration-runs/${runId}/reversion`)).expect(200);
    await asOperator(http().post(`/api/v1/admin/taxonomy/migration-runs/${runId}/reversion`)).expect(409);
    await revert(runId);

    expect(await pinsOf(alpha)).toBe(`${FROM}/1.2.0`);
    expect(await pinsOf(beta)).toBe(`${FROM}/1.2.0`);
    expect(await turnoverOf(alpha)).toBe('1000');
    expect((await migrationRows(alpha)).map((row) => row.status)).toEqual(['reverted']);
    const [withdrawn] = await reportUpdates('platform.notification.cancelled', beta.organizationId);
    expect(withdrawn.payload).toMatchObject({ subjectRef: `migration-run/${runId}` });

    const read = await readRun(runId);
    expect(read.revertedAt).not.toBeNull();
    expect(counted(read.tally)).toEqual({ reverted: 2 });
    await asOperator(http().post(`/api/v1/admin/taxonomy/migration-runs/${runId}/retry`)).expect(409);
  });

  it('holds a breaking pair’s report for its Organization Administrator rather than putting it in force (182/43)', async () => {
    const { object } = (await asOperator(http().get('/api/v1/admin/taxonomy')).expect(200)).body as {
      object: { mappings: { from: string; to: string; revision: number }[] };
    };
    const [{ revision }] = object.mappings.filter((mapping) => mapping.from === FROM && mapping.to === TO);
    await asOperator(http().put(`/api/v1/admin/taxonomy/mappings/${FROM}/${TO}`))
      .send({ determination: 'breaking', fields: [], expectedRevision: revision })
      .expect(200);

    const runId = await start({ organizationIds: [beta.organizationId] });
    await execute(runId);

    expect(await pinsOf(beta)).toBe(`${TO}/1.3.0`);
    expect((await migrationRows(beta)).map((row) => row.status)).toEqual(['reverted', 'awaiting_review']);
    const notices = await reportUpdates('platform.notification.raised', beta.organizationId);
    expect(notices.at(-1)?.payload).toMatchObject({
      subjectRef: `migration-run/${runId}`,
      deepLink: `/reports/${beta.reportId}/migration`,
      recipientUserIds: [betaAdmin.accountId],
      params: { cause: 'review', reach: 'one' },
    });
    expect(counted((await readRun(runId)).tally)).toEqual({ awaiting_review: 1 });
    // S-06 opens S-49 from the row: the report read says it awaits the decision.
    const read = await http().get(`/api/v1/reports/${beta.reportId}`).set(betaAdmin.authorization).expect(200);
    expect((read.body as { object: { migrationAwaiting: boolean } }).object.migrationAwaiting).toBe(true);
  });

  /**
   * S-49's api (task 67.20; UC-79; 182/43) over the report the breaking run just held — the Organization Administrator's
   * alone, a decline putting the report back, and an acceptance keeping it, each withdrawing the notice once nothing in
   * the organization still waits.
   */
  it('answers only within the organization, and a decline puts the report back as it was', async () => {
    // Another organization's administrator: row security hides the report entirely; the role's refusal is the matrix's.
    await http().get(`/api/v1/reports/${beta.reportId}/migration`).set(alphaAdmin.authorization).expect(404);
    const review = await http().get(`/api/v1/reports/${beta.reportId}/migration`).set(betaAdmin.authorization).expect(200);
    const read = (review.body as { object: { from: string; to: string; migratedAt: number; fields: unknown[] } }).object;
    expect({ from: read.from, to: read.to, fields: read.fields }).toEqual({ from: FROM, to: TO, fields: [] });
    expect(Number.isSafeInteger(read.migratedAt)).toBe(true);

    await writeTurnover(beta, betaAdmin, '777');
    await http().post(`/api/v1/reports/${beta.reportId}/migration/decline`).set(betaAdmin.authorization).expect(204);

    expect(await pinsOf(beta)).toBe(`${FROM}/1.2.0`);
    expect(await turnoverOf(beta)).toBeNull();
    const [declined] = (await migrationRows(beta)).slice(-1);
    expect(declined.status).toBe('declined');
    const [withdrawn] = (await reportUpdates('platform.notification.cancelled', beta.organizationId)).slice(-1);
    expect(withdrawn.payload).toMatchObject({ subjectRef: `migration-run/${runIds.at(-1)}` });

    const again = await http().post(`/api/v1/reports/${beta.reportId}/migration/decline`).set(betaAdmin.authorization).expect(404);
    expect((again.body as { type: string }).type).toBe(problemTypeUri(ProblemType.NotFound));
  });

  it('keeps an accepted report on the new version, and a platform revert leaves it as the organization decided', async () => {
    const runId = await start({ organizationIds: [beta.organizationId] });
    await execute(runId);
    await http().post(`/api/v1/reports/${beta.reportId}/migration/acceptance`).set(betaAdmin.authorization).expect(204);
    await http().post(`/api/v1/reports/${beta.reportId}/migration/acceptance`).set(betaAdmin.authorization).expect(404);

    await asOperator(http().post(`/api/v1/admin/taxonomy/migration-runs/${runId}/reversion`)).expect(200);
    await revert(runId);

    expect(await pinsOf(beta)).toBe(`${TO}/1.3.0`);
    expect(counted((await readRun(runId)).tally)).toEqual({ accepted: 1 });
  });
});

