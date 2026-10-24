import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { NOTIFICATION_CADENCES, type NotificationCadences } from '../src/contracts/notification-cadence.port';
import { NOTIFICATION_CATEGORY } from '../src/contracts/notification.port';
import { calendarDateIn } from '../src/contracts/types/time';
import { ConfigurationStore } from '../src/infrastructure/configuration/configuration-store.service';
import { seedConfiguration } from '../src/infrastructure/configuration/seed-configuration';
import { NoticePeriodsRepository } from '../src/infrastructure/persistence/core/notice-periods.repository';
import { ReportNoticeChecksRepository } from '../src/infrastructure/persistence/core/report-notice-checks.repository';
import { ReportNoticeDirectoryRepository } from '../src/infrastructure/persistence/core/report-notice-directory.repository';
import { NotificationRecipientsRepository } from '../src/infrastructure/persistence/identity/notification-recipients.repository';
import { NotificationOutboxRepository } from '../src/infrastructure/persistence/platform/notification-outbox.repository';
import { WorkerTenantWork } from '../src/infrastructure/persistence/worker-tenant-work';
import { configureHttpApp } from '../src/main.http';
import { DISCLOSURE_STATE } from '../src/modules/core/disclosure/models/disclosure-value.model';
import { OMITTED_DISCLOSURES_ELEMENT } from '../src/modules/core/disclosure/models/omission.model';
import { REPORT_NOTICE_CHECK } from '../src/modules/core/validation/constants/validation.constants';
import { ReportNoticeCheckHandler } from '../src/modules/core/validation/consumers/report-notice-check.handler';
import { CheckReportNotices } from '../src/modules/core/validation/use-cases/check-report-notices.use-case';
import { RunValidation } from '../src/modules/core/validation/use-cases/run-validation.use-case';
import { SweepReportNotices } from '../src/modules/core/validation/use-cases/sweep-report-notices.use-case';
import { MEMBERSHIP_ROLE } from '../src/modules/identity/membership/models/membership.model';
import { DisclosureLabelService } from '../src/modules/platform/localization/services/disclosure-label.service';
import { EntityFieldNamesService } from '../src/modules/platform/localization/services/entity-field-names.service';
import { NotificationRaisedHandler } from '../src/modules/platform/notification/consumers/notification-raised.handler';
import { NOTIFICATION_CANCELLED, NOTIFICATION_RAISED } from '../src/modules/platform/notification/constants/notification.constants';
import { CategoryChannels } from '../src/modules/platform/notification/services/category-channels.service';
import { EmailChannelService } from '../src/modules/platform/notification/services/email-channel.service';
import { NoticeParamsService } from '../src/modules/platform/notification/services/notice-params.service';
import { NotificationCategoryCatalog } from '../src/modules/platform/notification/services/notification-category-catalog.service';
import { DeliverNotification } from '../src/modules/platform/notification/use-cases/deliver-notification.use-case';
import { asOrganization, connectAs } from './support/database';
import {
  asJob,
  deleteNotificationsOf,
  NO_OPERATOR,
  notificationStore,
  OCCURRED_MICROS,
  optOuts,
  suppressionStore,
  unsubscribeTokens,
} from './support/notification-store';
import { cleanupSignedInAccounts, signInFreshAccount, type SignedInAccount } from './support/signed-in-account';

const ORG = '01930000-0000-7000-8000-000000051201';
const SUITE = 'report-notices.test';
const EMAILS = { admin: `oa@${SUITE}`, editor: `rc@${SUITE}`, viewer: `vo@${SUITE}` };
const CHISINAU = 'Europe/Chisinau';

/** The calendar day a number of days after a `YYYY-MM-DD`, counted on the calendar rather than in hours. */
const calendarDaysAfter = (input: { readonly date: string; readonly days: number }): string => {
  const [year, month, day] = input.date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + input.days)).toISOString().slice(0, 10);
};

/** Every module but B1 withdrawn, so a check lists only what B1 leaves. */
const OMITTED_MODULES = [
  'B2-PracticesPoliciesAndFutureInitiativesForTransitioningTowardsAMoreSustainableEconomyMember',
  'B3-EnergyAndGreenhouseGasEmissionsMember',
  'B4-PollutionOfAirWaterAndSoilMember',
  'B5-BiodiversityMember',
  'B6-WaterMember',
  'B7-ResourceUseCircularEconomyAndWasteManagementMember',
  'B8-WorkforceGeneralCharacteristicsMember',
  'B9-WorkforceHealthAndSafetyMember',
  'B10-WorkforceRemunerationCollectiveBargainingAndTrainingMember',
  'B11-ConvictionsAndFinesForCorruptionAndBriberyMember',
];
/** B1's required fields but the two the check is meant to find outstanding. */
const B1_DECLARED = [
  'BasisForPreparation', 'BasisForReporting', 'UndertakingsLegalForm', 'NaceSectorClassificationCodes',
  'NumberOfEmployees', 'EmployeeCountingMethodology', 'TypeOfNumberOfEmployees',
  'CountryOfPrimaryOperationsAndLocationOfSignificantAssets', 'AddressOfSite', 'PostalCodeOfSite', 'CityOfSite',
  'CountryOfSite', 'GPSLocationOfSite',
];
const LEFT_OUTSTANDING = ['Assets', 'Turnover'];

interface OutboxRow {
  organization_id: string | null;
  occurred_micros: string;
  idempotency_key: string;
  payload: Record<string, unknown>;
}

/**
 * **FR-164's and FR-165's notices, end to end over the test stack** (task 51.2; `architecture.md` §12.5.6's task-51.2
 * row): the unbound directory, the sweep's rows, a period's check as the worker runs it — its validation run stored as
 * the platform's, both notices raised to the members with edit access — the centre naming the fields in the reader's
 * language, and the two writes on the request tier that withdraw them: the answer that clears the list, and the lock.
 *
 * **The worker's half is built over its own role**, as task 37.3's suite builds it: `WorkerTenantWork` binds the
 * organization on an `esg_worker` connection, and the use case and its repositories are the application's own — every
 * repository reads the transaction the binding makes ambient, so what they prove is the worker's grants and policies.
 * The sweep's directory is narrowed to this suite's organization before it schedules, so no other suite's period is
 * checked; the directory's own unbound read is asserted whole.
 */
describe('the outstanding-report and deadline notices (task 51.2)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let worker: DataSource;
  let application: DataSource;
  const people = {} as Record<keyof typeof EMAILS, SignedInAccount>;
  let periodId: string;
  let reportId: string;
  let lockedPeriodId: string;
  let archivedPeriodId: string;
  let asOf: Date;

  const http = () => request(app.getHttpServer());
  const objectOf = <T>(body: unknown): T => (body as { object: T }).object;

  const outbox = (eventType: string): Promise<OutboxRow[]> =>
    worker.query(
      `SELECT organization_id, ${OCCURRED_MICROS}, idempotency_key, payload
         FROM audit.outbox_event
        WHERE event_type = $1 AND organization_id = $2
        ORDER BY occurred_at, idempotency_key`,
      [eventType, ORG],
    );
  const notices = async (eventType: string, categoryKey: string): Promise<OutboxRow[]> =>
    (await outbox(eventType)).filter((row) => row.payload.categoryKey === categoryKey);

  const cadences = (): NotificationCadences => app.get(NOTIFICATION_CADENCES, { strict: false });

  /** The worker's check, over its own role: the application's use case and repositories, bound by `WorkerTenantWork`. */
  const checkHandler = () =>
    new ReportNoticeCheckHandler(
      new CheckReportNotices(
        new NoticePeriodsRepository(),
        app.get(RunValidation, { strict: false }),
        cadences(),
        new WorkerTenantWork(worker),
        new NotificationOutboxRepository(),
      ),
    );

  /** The worker's notification consumer over its own role, delivering one committed raise as the dispatcher would. */
  const deliver = async (row: OutboxRow): Promise<void> => {
    const categories = new ConfigurationStore(application);
    await categories.refreshIfStale();
    const handler = new NotificationRaisedHandler(
      new DeliverNotification(
        new NotificationRecipientsRepository(worker),
        new EmailChannelService(
          { send: () => Promise.resolve({}) },
          suppressionStore(worker),
          new NoticeParamsService(new DisclosureLabelService(), new EntityFieldNamesService()),
          NO_OPERATOR,
        ),
        new CategoryChannels(new NotificationCategoryCatalog(categories)),
        notificationStore(worker),
        'https://app.easyesg.md',
        new NotificationCategoryCatalog(categories),
        optOuts(worker),
        unsubscribeTokens(),
        { publish: () => Promise.resolve() },
      ),
    );
    await handler.handle(asJob(row), { jobId: row.idempotency_key, jobName: NOTIFICATION_RAISED, attempt: 1, attempts: 1 });
  };

  const openPeriod = async (input: {
    readonly entityId: string;
    readonly year: number;
    readonly dueDate?: string;
  }): Promise<string> => {
    const period = await http().post('/api/v1/periods').set(people.admin.authorization).send({
      reportingEntityId: input.entityId,
      fiscalYear: input.year,
      periodStart: { date: `${input.year}-01-01`, timezone: CHISINAU },
      periodEnd: { date: `${input.year}-12-31`, timezone: CHISINAU },
      ...(input.dueDate === undefined ? {} : { dueDate: { date: input.dueDate, timezone: CHISINAU } }),
    }).expect(201);
    return objectOf<{ id: string }>(period.body).id;
  };

  // With an IDNO, which a filing needs since task 210 — the notices here are about the report's own answers.
  const newEntity = async (name: string): Promise<string> =>
    objectOf<{ id: string }>((await http().post('/api/v1/entities').set(people.admin.authorization).send({
      name, legalForm: 'srl', naceCodes: ['10.71'], idno: '1003600005148',
      sites: [{ name: 'Fabrica', locality: 'Chișinău', countryCode: 'MD' }],
    }).expect(201)).body).id;

  const write = (values: Record<string, unknown>[]) =>
    http().put(`/api/v1/reports/${reportId}/values`).set(people.editor.authorization).send({ values }).expect(200);

  const removeFixtures = async (): Promise<void> => {
    await owner.query(`DELETE FROM audit.outbox_event WHERE organization_id = $1`, [ORG]);
    await deleteNotificationsOf(owner, ORG);
    await asOrganization(owner, ORG, (run) => run(`DELETE FROM core.organization WHERE id = $1`, [ORG]));
    await owner.query(
      `DELETE FROM notification.preference WHERE account_id IN (SELECT id FROM identity.account WHERE email = ANY($1))`,
      [Object.values(EMAILS)],
    );
    await owner.query(`DELETE FROM identity.account WHERE email = ANY($1)`, [Object.values(EMAILS)]);
  };

  beforeAll(async () => {
    await initialiseCatalogue();
    @Module({ imports: [AppModule] })
    class TestAppModule {}
    app = await NestFactory.create<NestExpressApplication>(TestAppModule, { logger: false });
    configureHttpApp(app);
    await app.init();

    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-report-notices-owner');
    worker = await connectAs('DB_WORKER_USER', 'DB_WORKER_PASSWORD', 'easyesg-report-notices-worker');
    application = await connectAs('DB_USER', 'DB_PASSWORD', 'easyesg-report-notices-app');
    // The suite seeds what it reads: the two categories' artefacts carry the cadence the check keeps.
    await seedConfiguration(application);
    await app.get(ConfigurationStore).poll();
    await removeFixtures();

    await asOrganization(owner, null, (run) =>
      run(`INSERT INTO core.organization (id, name, country_code) VALUES ($1, 'Brutăria Notițe SRL', 'MD')`, [ORG]));
    const server = app.getHttpServer();
    for (const key of Object.keys(EMAILS) as (keyof typeof EMAILS)[]) {
      people[key] = await signInFreshAccount({ server, worker, email: EMAILS[key] });
    }
    for (const [person, role] of [
      [people.admin, MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR],
      [people.editor, MEMBERSHIP_ROLE.EDITOR],
      [people.viewer, MEMBERSHIP_ROLE.VIEWER],
    ] as const) {
      await asOrganization(owner, ORG, (run) =>
        run(`INSERT INTO identity.membership (account_id, organization_id, role) VALUES ($1, $2, $3)`, [
          person.accountId,
          ORG,
          role,
        ]));
    }

    // The report is created now, so a check seven days on is its first repeat day, and its due date seven days after
    // that is the 7-day lead time: one moment owes both notices. Both steps are taken on Chișinău's calendar, as the
    // check counts them: seven times 24 hours across the end of summer time lands on the sixth day when it starts in
    // the hour after midnight, and on the eighth across its start when it starts in the hour before.
    const entityId = await newEntity('Brutăria Notițe');
    const checkDay = calendarDaysAfter({ date: calendarDateIn({ instant: new Date(), timezone: CHISINAU }), days: 7 });
    // Midday UTC is the same day in Chișinău at either offset.
    asOf = new Date(`${checkDay}T12:00:00Z`);
    periodId = await openPeriod({ entityId, year: 2026, dueDate: calendarDaysAfter({ date: checkDay, days: 7 }) });
    reportId = objectOf<{ id: string }>((await http().post('/api/v1/reports').set(people.editor.authorization)
      .send({ reportingPeriodId: periodId }).expect(201)).body).id;
    await write([
      {
        elementKey: OMITTED_DISCLOSURES_ELEMENT,
        valueText: OMITTED_MODULES.map((member) => `vsme:${member}`).join(' '),
        state: DISCLOSURE_STATE.OK,
      },
      ...B1_DECLARED.map((elementKey) => ({
        elementKey,
        state: DISCLOSURE_STATE.NOT_AVAILABLE,
        notAvailableReason: 'Informația nu este disponibilă',
      })),
    ]);

    // A locked period and an archived entity's open period: neither is the sweep's.
    lockedPeriodId = await openPeriod({ entityId, year: 2025 });
    await http().post(`/api/v1/periods/${lockedPeriodId}/lock`).set(people.admin.authorization).expect(200);
    const archivedEntityId = await newEntity('Moara Arhivată');
    archivedPeriodId = await openPeriod({ entityId: archivedEntityId, year: 2026 });
    await http().post(`/api/v1/entities/${archivedEntityId}/archive`).set(people.admin.authorization).expect(204);
    // The lock above withdrew notices nobody raised; the suite reads only what it causes from here.
    await owner.query(`DELETE FROM audit.outbox_event WHERE organization_id = $1`, [ORG]);
  }, 180_000);

  afterAll(async () => {
    await cleanupSignedInAccounts({ owner });
    if (owner) await removeFixtures();
    await app?.close();
    for (const source of [owner, worker, application]) if (source?.isInitialized) await source.destroy();
  });

  it('lists every open period of an active entity, unbound, and neither a locked one nor an archived entity’s', async () => {
    const mine = (await new ReportNoticeDirectoryRepository(worker).openPeriods()).filter(
      (period) => period.organizationId === ORG,
    );
    expect(mine.map((period) => period.periodId)).toEqual([periodId]);
    expect(mine.map((period) => period.periodId)).not.toContain(lockedPeriodId);
    expect(mine.map((period) => period.periodId)).not.toContain(archivedPeriodId);
    expect(mine[0].reportCreatedAt).toBeInstanceOf(Date);
  });

  /**
   * The three directory policies' three states, asserted as task 37.3's are: the worker reads an organization's
   * periods, reports and entities across tenants only while nothing is bound; bound to another organization it reads
   * none of this one's; and the request tier's role gains nothing. **The conjunct `app.current_org IS NULL` is what the
   * second line proves** — without it the permissive policy would answer a bound worker's every read across tenants.
   */
  it('lets the worker read across organizations only while none is bound', async () => {
    const count = (rows: unknown) => (rows as { count: number }[])[0].count;
    for (const table of ['core.reporting_period', 'core.report', 'core.reporting_entity']) {
      const ours = `SELECT count(*)::int AS count FROM ${table} WHERE organization_id = $1`;
      expect(count(await worker.query(ours, [ORG]))).toBeGreaterThan(0);
      expect(count(await asOrganization(worker, randomUUID(), (run) => run(ours, [ORG])))).toBe(0);
      expect(count(await application.query(ours, [ORG]))).toBe(0);
    }
  });

  it('schedules one check for the period that owes one, once however often the day is swept', async () => {
    const directory = new ReportNoticeDirectoryRepository(worker);
    const sweep = new SweepReportNotices(
      { openPeriods: async () => (await directory.openPeriods()).filter((period) => period.organizationId === ORG) },
      cadences(),
      new ReportNoticeChecksRepository(worker),
    );
    const day = calendarDateIn({ instant: asOf, timezone: CHISINAU });

    await expect(sweep.execute({ asOf, day })).resolves.toBe(1);
    await expect(sweep.execute({ asOf, day })).resolves.toBe(0);

    const rows = await outbox(REPORT_NOTICE_CHECK);
    expect(rows).toEqual([
      expect.objectContaining({
        idempotency_key: `${REPORT_NOTICE_CHECK}/${periodId}/${day}`,
        payload: { periodId, asOf: asOf.getTime() },
      }),
    ]);
  });

  describe('a period’s check', () => {
    beforeAll(async () => {
      const [row] = await outbox(REPORT_NOTICE_CHECK);
      await checkHandler().handle(asJob(row));
    });

    it('stores its validation run as the platform’s — no person named', async () => {
      const runs = await asOrganization(owner, ORG, (run) =>
        run(`SELECT evaluated_by, outstanding FROM core.validation_run WHERE report_id = $1`, [reportId]),
      );
      expect(runs).toEqual([{ evaluated_by: null, outstanding: 2 }]);
    });

    it('raises the outstanding-report notice naming the two fields left, to the members with edit access alone', async () => {
      const [raised] = await notices(NOTIFICATION_RAISED, NOTIFICATION_CATEGORY.OUTSTANDING_REPORT);
      expect(raised.payload).toMatchObject({
        subjectRef: `report:${reportId}:outstanding`,
        deepLink: `/reports/${reportId}`,
        params: {
          count: 2,
          intervalDays: 7,
          fields: { fieldList: { taxonomyVersion: '2026-05-01', modules: [{ module: 'B1', elementKeys: LEFT_OUTSTANDING }] } },
        },
      });
      expect([...(raised.payload.recipientUserIds as string[])].sort()).toEqual(
        [people.admin.accountId, people.editor.accountId].sort(),
      );
    });

    it('withdraws the open outstanding notice in an earlier transaction than it raises the new one (FR-167)', async () => {
      const [cancelled] = await notices(NOTIFICATION_CANCELLED, NOTIFICATION_CATEGORY.OUTSTANDING_REPORT);
      const [raised] = await notices(NOTIFICATION_RAISED, NOTIFICATION_CATEGORY.OUTSTANDING_REPORT);
      expect(cancelled.payload).toMatchObject({ subjectRef: `report:${reportId}:outstanding` });
      expect(BigInt(raised.occurred_micros)).toBeGreaterThan(BigInt(cancelled.occurred_micros));
    });

    it('raises the 7-day deadline notice with the date, the days remaining and how far the report has come', async () => {
      const [raised] = await notices(NOTIFICATION_RAISED, NOTIFICATION_CATEGORY.REPORT_DEADLINE);
      expect(raised.payload).toMatchObject({
        subjectRef: `period:${periodId}:deadline:7`,
        params: { daysRemaining: 7, started: 'yes', outstanding: 2 },
      });
    });

    it('names the fields in the reader’s language in the centre, and never by their keys', async () => {
      const [raised] = await notices(NOTIFICATION_RAISED, NOTIFICATION_CATEGORY.OUTSTANDING_REPORT);
      await deliver(raised);

      const centre = (await http().get('/api/v1/notifications').set(people.editor.authorization)
        .set('Accept-Language', 'ro').expect(200)).body as { objects: { categoryKey: string; title: string; body: string }[] };
      const entry = centre.objects.find((each) => each.categoryKey === NOTIFICATION_CATEGORY.OUTSTANDING_REPORT);
      const labels = new DisclosureLabelService();
      for (const key of LEFT_OUTSTANDING) {
        expect(entry?.body).toContain(labels.label({ version: '2026-05-01', locale: 'ro', key })?.text);
        expect(entry?.body).not.toContain(key);
      }
      expect(entry?.title).toContain('2 câmpuri');
    });
  });

  describe('the writes that clear the condition (182/134)', () => {
    it('withdraws nothing for an answer that leaves a listed field open', async () => {
      await write([{ elementKey: 'Assets', valueNumeric: '1250000', state: DISCLOSURE_STATE.OK }]);
      expect(await notices(NOTIFICATION_CANCELLED, NOTIFICATION_CATEGORY.OUTSTANDING_REPORT)).toHaveLength(1);
    });

    it('withdraws the outstanding notice on the write that answers the last listed field', async () => {
      await write([{ elementKey: 'Turnover', valueNumeric: '3400000', state: DISCLOSURE_STATE.OK }]);
      const cancelled = await notices(NOTIFICATION_CANCELLED, NOTIFICATION_CATEGORY.OUTSTANDING_REPORT);
      expect(cancelled).toHaveLength(2);
      expect(cancelled[1].payload).toMatchObject({ subjectRef: `report:${reportId}:outstanding` });
    });

    it('withdraws the outstanding notice and every lead time’s deadline notice when the period is locked', async () => {
      await http().post(`/api/v1/periods/${periodId}/lock`).set(people.admin.authorization).expect(200);
      const outstanding = await notices(NOTIFICATION_CANCELLED, NOTIFICATION_CATEGORY.OUTSTANDING_REPORT);
      const deadlines = await notices(NOTIFICATION_CANCELLED, NOTIFICATION_CATEGORY.REPORT_DEADLINE);
      expect(outstanding).toHaveLength(3);
      // One transaction's rows share its time, so their order is the random key's: compared as a set.
      expect(deadlines.map((row) => row.payload.subjectRef).sort()).toEqual(
        [14, 7, 1].map((lead) => `period:${periodId}:deadline:${lead}`).sort(),
      );
    });
  });
});
