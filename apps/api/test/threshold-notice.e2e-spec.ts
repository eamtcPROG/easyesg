import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { ConfigurationHistory } from '../src/infrastructure/configuration/configuration-history.service';
import { ConfigurationPublisher } from '../src/infrastructure/configuration/configuration-publisher.service';
import { ConfigurationStore } from '../src/infrastructure/configuration/configuration-store.service';
import { OpenReportDirectoryRepository } from '../src/infrastructure/persistence/core/open-report-directory.repository';
import { ReportUpdateSubjectsRepository } from '../src/infrastructure/persistence/core/report-update-subjects.repository';
import { NotificationOutboxRepository } from '../src/infrastructure/persistence/platform/notification-outbox.repository';
import { WorkerTenantWork } from '../src/infrastructure/persistence/worker-tenant-work';
import { configureHttpApp } from '../src/main.http';
import { APPLICABILITY_REPLACED, DISCLOSURE_APPLICABILITY_CONFIG_KIND } from '../src/modules/core/disclosure/constants/disclosure.constants';
import { ApplicabilityReplacedHandler } from '../src/modules/core/disclosure/consumers/applicability-replaced.handler';
import { DISCLOSURE_STATE } from '../src/modules/core/disclosure/models/disclosure-value.model';
import { ApplicabilityHistoryService } from '../src/modules/core/disclosure/services/applicability-history.service';
import { NotifyApplicabilityReplaced } from '../src/modules/core/disclosure/use-cases/notify-applicability-replaced.use-case';
import { ReadWizardStep } from '../src/modules/core/disclosure/use-cases/read-wizard-step.use-case';
import { asOrganization, connectAs, databaseNow, deleteApplicabilityReplacements } from './support/database';
import { openReport } from './support/opened-report';
import { cleanupSignedInAccounts, signInFreshAccount, type SignedInAccount } from './support/signed-in-account';

/**
 * FR-166's threshold half (task 67.8; UC-81; 182/135 … 182/137) over real tables: a threshold change published into the
 * store is announced, and the worker's handler — built over the worker's own role, as `factor-set-notice.e2e-spec.ts`
 * builds its own — tells the organization whose open report the change obliges, and nobody whose report it leaves as it
 * was. What only this level shows: that the comparison reads each report's own stored answers through the wizard's
 * evaluation, bound to its organization.
 */
const RUN = `${process.pid}-${Date.now()}`;
const STANDARD = 'vsme';
const HEADCOUNT = 'NumberOfEmployees';

describe('a threshold change’s notice (task 67.8)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let worker: DataSource;
  let obliged: SignedInAccount;
  let untouched: SignedInAccount;
  let reports: { obliged: { organizationId: string; reportId: string }; untouched: { organizationId: string; reportId: string } };
  let since: Date;

  const writeHeadcount = (account: SignedInAccount, reportId: string, value: string) =>
    request(app.getHttpServer())
      .put(`/api/v1/reports/${reportId}/values`)
      .set(account.authorization)
      .send({ values: [{ elementKey: HEADCOUNT, valueNumeric: value, state: DISCLOSURE_STATE.OK }] })
      .expect(200);
  const raisedIn = (organizationId: string) =>
    worker.query<{ payload: Record<string, unknown> }[]>(
      `SELECT payload FROM audit.outbox_event
        WHERE event_type = 'platform.notification.raised' AND organization_id = $1 AND payload->>'categoryKey' = 'reporting.report_update'`,
      [organizationId],
    );

  beforeAll(async () => {
    await initialiseCatalogue();
    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
    configureHttpApp(app);
    await app.init();
    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-threshold-notice-owner');
    worker = await connectAs('DB_WORKER_USER', 'DB_WORKER_PASSWORD', 'easyesg-threshold-notice-worker');
    since = await databaseNow(owner);

    const server = app.getHttpServer();
    obliged = await signInFreshAccount({ server, worker, email: `threshold-a-${RUN}@threshold.test` });
    untouched = await signInFreshAccount({ server, worker, email: `threshold-b-${RUN}@threshold.test` });
    reports = {
      obliged: await openReport({ server, administrator: obliged, name: `Prag A ${RUN}`, fiscalYear: 2026 }),
      untouched: await openReport({ server, administrator: untouched, name: `Prag B ${RUN}`, fiscalYear: 2026 }),
    };
    // 40 employees: below 50 and above 20, so lowering the threshold to 20 obliges this report.
    await writeHeadcount(obliged, reports.obliged.reportId, '40');
    // 10 employees: below either threshold, so the change leaves this one as it was.
    await writeHeadcount(untouched, reports.untouched.reportId, '10');
  }, 180_000);

  afterAll(async () => {
    if (owner?.isInitialized) {
      await deleteApplicabilityReplacements({ owner, since });
      for (const { organizationId } of [reports?.obliged, reports?.untouched].filter((entry) => entry !== undefined)) {
        await owner.query(`DELETE FROM audit.outbox_event WHERE organization_id = $1`, [organizationId]);
        await asOrganization(owner, organizationId, (run) => run(`DELETE FROM core.organization WHERE id = $1`, [organizationId]));
      }
    }
    await cleanupSignedInAccounts({ owner });
    await app?.close();
    for (const source of [owner, worker]) {
      if (source?.isInitialized) await source.destroy();
    }
  });

  it('tells the organization whose open report a lower threshold obliges, and leaves the other untold', async () => {
    const store = app.get(ConfigurationStore);
    const shipped = store.get({ kind: DISCLOSURE_APPLICABILITY_CONFIG_KIND, scope: STANDARD });
    const rules = (shipped?.payload as { rules: { condition: Record<string, unknown> }[] }).rules;
    const publisher = app.get(ConfigurationPublisher);
    try {
      await publisher.publish({
        kind: DISCLOSURE_APPLICABILITY_CONFIG_KIND,
        scope: STANDARD,
        payload: {
          rules: rules.map((rule) => (rule.condition.threshold === '50' ? { ...rule, condition: { ...rule.condition, threshold: '20' } } : rule)),
        },
      });
      const [announced] = await worker.query<{ payload: Record<string, unknown> }[]>(
        `SELECT payload FROM audit.outbox_event WHERE event_type = $1 AND occurred_at >= $2 ORDER BY occurred_at DESC LIMIT 1`,
        [APPLICABILITY_REPLACED, since],
      );
      expect(announced.payload).toMatchObject({ scope: STANDARD });

      const handler = new ApplicabilityReplacedHandler(
        new NotifyApplicabilityReplaced(
          new ApplicabilityHistoryService(new ConfigurationHistory(worker)),
          new OpenReportDirectoryRepository(worker),
          app.get(ReadWizardStep),
          new ReportUpdateSubjectsRepository(),
          new WorkerTenantWork(worker),
          new NotificationOutboxRepository(),
        ),
      );
      await handler.handle(announced.payload);

      const [notice] = await raisedIn(reports.obliged.organizationId);
      expect(notice.payload).toMatchObject({
        recipientUserIds: [obliged.accountId],
        deepLink: `/reports/${reports.obliged.reportId}`,
        params: { cause: 'thresholds', reach: 'one', fiscalYear: '2026' },
      });
      expect(await raisedIn(reports.untouched.organizationId)).toEqual([]);
    } finally {
      await publisher.publish({ kind: DISCLOSURE_APPLICABILITY_CONFIG_KIND, scope: STANDARD, payload: shipped?.payload ?? { rules } });
      await store.refreshIfStale();
    }
  });

  it('refuses a rule set with a rule the wizard would drop, and publishes nothing', async () => {
    const before = app.get(ConfigurationStore).get({ kind: DISCLOSURE_APPLICABILITY_CONFIG_KIND, scope: STANDARD })?.revision;
    await expect(
      app.get(ConfigurationPublisher).publish({
        kind: DISCLOSURE_APPLICABILITY_CONFIG_KIND,
        scope: STANDARD,
        payload: { rules: [{ elements: ['EmployeeTurnoverRate'], condition: { kind: 'numeric_at_least', elementKey: HEADCOUNT, threshold: 'fifty' } }] },
      }),
    ).rejects.toThrow(/unreadable/);
    await app.get(ConfigurationStore).refreshIfStale();
    expect(app.get(ConfigurationStore).get({ kind: DISCLOSURE_APPLICABILITY_CONFIG_KIND, scope: STANDARD })?.revision).toBe(before);
  });
});
