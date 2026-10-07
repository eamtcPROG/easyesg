import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { NOTIFICATION_CATEGORY } from '../src/contracts/notification.port';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { ConfigurationHistory } from '../src/infrastructure/configuration/configuration-history.service';
import { ConfigurationPayloadRefusedError } from '../src/infrastructure/configuration/configuration-payload-refused.error';
import { ConfigurationPublisher } from '../src/infrastructure/configuration/configuration-publisher.service';
import { ConfigurationStore } from '../src/infrastructure/configuration/configuration-store.service';
import { seedConfiguration } from '../src/infrastructure/configuration/seed-configuration';
import { FactorSetUsersRepository } from '../src/infrastructure/persistence/core/factor-set-users.repository';
import { ReportUpdateAudienceRepository } from '../src/infrastructure/persistence/core/report-update-audience.repository';
import { NotificationRecipientsRepository } from '../src/infrastructure/persistence/identity/notification-recipients.repository';
import { NotificationOutboxRepository } from '../src/infrastructure/persistence/platform/notification-outbox.repository';
import { WorkerTenantWork } from '../src/infrastructure/persistence/worker-tenant-work';
import { configureHttpApp } from '../src/main.http';
import { EMISSION_FACTOR_SET_CONFIG_KIND, FACTOR_SET_REPLACED } from '../src/modules/core/calculator/constants/calculator.constants';
import { FactorSetReplacedHandler } from '../src/modules/core/calculator/consumers/factor-set-replaced.handler';
import { FactorSetCatalog } from '../src/modules/core/calculator/services/factor-set-catalog.service';
import { NotifyFactorSetReplaced } from '../src/modules/core/calculator/use-cases/notify-factor-set-replaced.use-case';
import { MEMBERSHIP_ROLE } from '../src/modules/identity/membership/models/membership.model';
import { NotificationRaisedHandler } from '../src/modules/platform/notification/consumers/notification-raised.handler';
import { NOTIFICATION_CANCELLED, NOTIFICATION_RAISED } from '../src/modules/platform/notification/constants/notification.constants';
import { CategoryChannels } from '../src/modules/platform/notification/services/category-channels.service';
import { EmailChannelService } from '../src/modules/platform/notification/services/email-channel.service';
import { NotificationCategoryCatalog } from '../src/modules/platform/notification/services/notification-category-catalog.service';
import { DeliverNotification } from '../src/modules/platform/notification/use-cases/deliver-notification.use-case';
import { asOrganization, connectAs, databaseNow, deleteFactorSetReplacements } from './support/database';
import {
  asJob,
  deleteNotificationsOf,
  notificationStore,
  OCCURRED_MICROS,
  optOuts,
  suppressionStore,
  unsubscribeTokens,
} from './support/notification-store';
import { cleanupSignedInAccounts, signInFreshAccount, type SignedInAccount } from './support/signed-in-account';

/**
 * A factor set validated at publication, and FR-166's factor notice when one is replaced — on the stack (tasks 37.3,
 * 37.4; `architecture.md` §12.5.6's task-37.3/37.4 row).
 *
 * **Two organizations with a run on the set in force.** Alpha's report is open; Beta's period is locked after its run,
 * so Beta has a run on the set and nothing left it can recalculate. A correction published into the window must tell
 * Alpha's editors and administrator, not its viewer, and must tell Beta nothing (FR-166 AC-3, AC-5).
 *
 * **The worker's half is driven by hand**, as `report-reminder.e2e-spec.ts` drives it: the outbox row the publication
 * committed is handed to the handler over the worker's own role, with the real adapters — the unbound read under the
 * policy this task added, each organization bound in turn, and the raise written on that binding. **The slot is put
 * back by revert**, which is itself the second case: the revert announces a replacement too, and withdraws Alpha's
 * notice.
 */
const ALPHA = '01930000-0000-7000-8000-0000000037a1';
const BETA = '01930000-0000-7000-8000-0000000037b1';
const SUITE = 'factor-notice.test';
const EMAILS = {
  alphaAdmin: `oa-a@${SUITE}`,
  alphaEditor: `rc-a@${SUITE}`,
  alphaViewer: `vo-a@${SUITE}`,
  betaAdmin: `oa-b@${SUITE}`,
};
const CHISINAU = 'Europe/Chisinau';
const SLOT = { kind: EMISSION_FACTOR_SET_CONFIG_KIND, scope: 'md' };
const WINDOW = { validTo: '2027-01-01' };

interface OutboxRow {
  organization_id: string | null;
  occurred_micros: string;
  idempotency_key: string;
  payload: Record<string, unknown>;
}

interface FactorSetPayload {
  label: string;
  sources: Record<string, unknown>[];
}

describe('the factor set at publication and its replacement notice (tasks 37.3, 37.4)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let worker: DataSource;
  let application: DataSource;
  let publisher: ConfigurationPublisher;
  /** When the suite began, on the database's clock — its own replacement rows are removed from then, never others'. */
  let began: Date;
  let store: ConfigurationStore;

  const people: Record<keyof typeof EMAILS, SignedInAccount> = {} as Record<keyof typeof EMAILS, SignedInAccount>;
  let alphaReport: string;
  let inForce: { revision: number; payload: FactorSetPayload };

  const http = () => request(app.getHttpServer());

  /** Outbox rows of one type, oldest first — for a platform row, `organization` is `null`. */
  const outbox = (eventType: string, organization: string | null): Promise<OutboxRow[]> =>
    worker.query(
      `SELECT organization_id, ${OCCURRED_MICROS}, idempotency_key, payload
         FROM audit.outbox_event
        WHERE event_type = $1 AND organization_id IS NOT DISTINCT FROM $2
        ORDER BY occurred_at, idempotency_key`,
      [eventType, organization],
    );

  /** The notice rows this category raised or withdrew in one organization. */
  const reportUpdates = async (eventType: string, organization: string): Promise<OutboxRow[]> =>
    (await outbox(eventType, organization)).filter(
      (row) => row.payload.categoryKey === NOTIFICATION_CATEGORY.REPORT_UPDATE,
    );

  /** The worker's handler over its own role, handed the newest replacement the publisher announced. */
  const handleLatestReplacement = async (): Promise<Record<string, unknown>> => {
    const rows = await outbox(FACTOR_SET_REPLACED, null);
    const row = rows.at(-1);
    if (row === undefined) throw new Error('The publication announced no replacement');
    const handler = new FactorSetReplacedHandler(
      new NotifyFactorSetReplaced(
        new FactorSetUsersRepository(worker),
        new ReportUpdateAudienceRepository(),
        new FactorSetCatalog(new ConfigurationStore(worker), new ConfigurationHistory(worker)),
        new WorkerTenantWork(worker),
        new NotificationOutboxRepository(),
      ),
    );
    await handler.handle(asJob(row));
    return row.payload;
  };

  /** A period for 2026 over a fresh entity, its report, one gas line and a run — answering the report and period. */
  const calculatedReport = async (admin: SignedInAccount, name: string): Promise<{ reportId: string; periodId: string }> => {
    const entity = await http().post('/api/v1/entities').set(admin.authorization).send({
      name, legalForm: 'srl', naceCodes: ['10.71'],
      sites: [{ name: 'Fabrica', locality: 'Chișinău', countryCode: 'MD' }],
    }).expect(201);
    const entityId = (entity.body as { object: { id: string } }).object.id;
    const period = await http().post('/api/v1/periods').set(admin.authorization).send({
      reportingEntityId: entityId,
      fiscalYear: 2026,
      periodStart: { date: '2026-01-01', timezone: CHISINAU },
      periodEnd: { date: '2026-12-31', timezone: CHISINAU },
    }).expect(201);
    const periodId = (period.body as { object: { id: string } }).object.id;
    const report = await http().post('/api/v1/reports').set(admin.authorization)
      .send({ reportingPeriodId: periodId }).expect(201);
    const reportId = (report.body as { object: { id: string } }).object.id;
    await http().put(`/api/v1/reports/${reportId}/calculator/sources/${randomUUID()}`).set(admin.authorization)
      .send({ siteOrdinal: 0, sourceKey: 'natural_gas', quantity: '500', unitCode: 'm3' }).expect(200);
    await http().post(`/api/v1/reports/${reportId}/calculator/runs`).set(admin.authorization).expect(201);
    return { reportId, periodId };
  };

  /**
   * Runs carry no `DELETE` policy, so `FORCE` is lifted for the cleanup inside one transaction, as the calculator's suite
   * does — and Beta's period is locked, so the lock trigger on the four calculator tables is suspended in the same
   * transaction: the immutability the suite relies on, met by its own cleanup. No other session sees either lifted.
   */
  const removeCalculations = (organization: string) =>
    asOrganization(owner, organization, async (run) => {
      for (const table of ['core.calc_input', 'core.calc_result', 'core.calc_run', 'core.calc_source']) {
        await run(`ALTER TABLE ${table} NO FORCE ROW LEVEL SECURITY`);
        await run(`ALTER TABLE ${table} DISABLE TRIGGER refuse_locked_write`);
        await run(`DELETE FROM ${table} WHERE organization_id = $1`, [organization]);
        await run(`ALTER TABLE ${table} ENABLE TRIGGER refuse_locked_write`);
        await run(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
      }
    });

  const cleanup = async () => {
    await owner.query(`DELETE FROM audit.outbox_event WHERE organization_id = ANY($1)`, [[ALPHA, BETA]]);
    if (began !== undefined) await deleteFactorSetReplacements({ owner, scope: 'md', since: began });
    for (const organization of [ALPHA, BETA]) {
      await deleteNotificationsOf(owner, organization);
      await removeCalculations(organization);
      await asOrganization(owner, organization, (run) => run(`DELETE FROM core.organization WHERE id = $1`, [organization]));
    }
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

    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-factor-notice-owner');
    worker = await connectAs('DB_WORKER_USER', 'DB_WORKER_PASSWORD', 'easyesg-factor-notice-worker');
    application = await connectAs('DB_USER', 'DB_PASSWORD', 'easyesg-factor-notice-app');
    began = await databaseNow(owner);
    // The suite seeds what it reads: the category's artefact decides its channels.
    await seedConfiguration(application);
    await cleanup();

    publisher = app.get(ConfigurationPublisher);
    store = app.get(ConfigurationStore);
    await store.poll();
    const entry = store.get<FactorSetPayload>({ ...SLOT, on: '2026-01-01' });
    if (entry === undefined) throw new Error('The shipped md set is not in force on the test stack');
    inForce = { revision: entry.revision, payload: entry.payload };

    for (const [organization, name] of [[ALPHA, 'Alpha SRL'], [BETA, 'Beta SRL']] as const) {
      await asOrganization(owner, null, (run) =>
        run(`INSERT INTO core.organization (id, name, country_code) VALUES ($1, $2, 'MD')`, [organization, name]));
    }
    const server = app.getHttpServer();
    for (const key of Object.keys(EMAILS) as (keyof typeof EMAILS)[]) {
      people[key] = await signInFreshAccount({ server, worker, email: EMAILS[key] });
    }
    for (const [person, organization, role] of [
      [people.alphaAdmin, ALPHA, MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR],
      [people.alphaEditor, ALPHA, MEMBERSHIP_ROLE.EDITOR],
      [people.alphaViewer, ALPHA, MEMBERSHIP_ROLE.VIEWER],
      [people.betaAdmin, BETA, MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR],
    ] as const) {
      await asOrganization(owner, organization, (run) =>
        run(`INSERT INTO identity.membership (account_id, organization_id, role) VALUES ($1, $2, $3)`, [
          person.accountId,
          organization,
          role,
        ]));
    }

    alphaReport = (await calculatedReport(people.alphaAdmin, 'Brutăria Alpha')).reportId;
    // Beta has a run on the set, and then nothing it can recalculate: its period is locked (FR-22).
    const beta = await calculatedReport(people.betaAdmin, 'Moara Beta');
    await http().post(`/api/v1/periods/${beta.periodId}/lock`).set(people.betaAdmin.authorization).expect(200);
  }, 180_000);

  afterAll(async () => {
    await cleanupSignedInAccounts({ owner });
    if (owner) await cleanup();
    await app?.close();
    for (const source of [owner, worker, application]) if (source?.isInitialized) await source.destroy();
  });

  describe('a factor set at publication (task 37.4)', () => {
    const malformed = { key: 'lpg', ghgScope: 'scope_1', emissionFactor: 0.227, units: { l: '0.0068' }, reference: 'a number, not a decimal string' };

    it.each([
      ['one the reader cannot read', () => ({ label: '2026.x', sources: [] }), 'none of its sources is readable'],
      [
        'one with a source the reader would drop',
        () => ({ ...inForce.payload, label: '2026.x', sources: [...inForce.payload.sources, malformed] }),
        'it carries malformed source(s): lpg',
      ],
    ])('refuses %s, publishing nothing and announcing nothing', async (_, payload, reason) => {
      const announced = (await outbox(FACTOR_SET_REPLACED, null)).length;

      const refusal = publisher.publish({ ...SLOT, ...WINDOW, payload: payload() });
      await expect(refusal).rejects.toBeInstanceOf(ConfigurationPayloadRefusedError);
      await expect(refusal).rejects.toThrow(reason);

      await store.poll();
      expect(store.get({ ...SLOT, on: '2026-01-01' })?.revision).toBe(inForce.revision);
      expect(await outbox(FACTOR_SET_REPLACED, null)).toHaveLength(announced);
    });
  });

  describe('the replacement notice (task 37.3)', () => {
    /**
     * The policy's three states, the way task 25.3's directory is asserted: the worker sees every organization's runs
     * only while nothing is bound, sees its tenant's alone when bound, and the request tier's role gains nothing.
     */
    it('lets the worker list the organizations using a revision only while no organization is bound', async () => {
      const using = `SELECT DISTINCT organization_id FROM core.calc_run
                      WHERE organization_id = ANY($1) ORDER BY organization_id`;
      const ids = (rows: unknown) => (rows as { organization_id: string }[]).map((row) => row.organization_id);

      expect(ids(await worker.query(using, [[ALPHA, BETA]]))).toEqual([ALPHA, BETA]);
      expect(ids(await asOrganization(worker, ALPHA, (run) => run(using, [[ALPHA, BETA]])))).toEqual([ALPHA]);
      expect(ids(await application.query(using, [[ALPHA, BETA]]))).toEqual([]);
    });

    it('tells the open report’s editors and administrator, not its viewer, and nobody in a locked one’s organization', async () => {
      try {
        const { revision: correction } = await publisher.publish({
          ...SLOT,
          ...WINDOW,
          payload: { ...inForce.payload, label: '2026.2' },
        });

        expect(await handleLatestReplacement()).toEqual({
          scope: 'md',
          leavingRevision: inForce.revision,
          enteringRevision: correction,
        });

        const [raised, ...more] = await reportUpdates(NOTIFICATION_RAISED, ALPHA);
        expect(more).toEqual([]);
        expect(raised.payload).toMatchObject({
          subjectRef: `factor-set:md:${inForce.revision}`,
          deepLink: `/reports/${alphaReport}/calculator`,
          params: {
            reach: 'one',
            setLabel: inForce.payload.label,
            newSetLabel: '2026.2',
            entityName: 'Brutăria Alpha',
            fiscalYear: '2026',
          },
        });
        expect([...(raised.payload.recipientUserIds as string[])].sort()).toEqual(
          [people.alphaAdmin.accountId, people.alphaEditor.accountId].sort(),
        );
        expect(await reportUpdates(NOTIFICATION_RAISED, BETA)).toEqual([]);

        // Delivered as the worker delivers it: the category's artefact puts it in the centre, worded in Romanian.
        await deliver(raised);
        const [notice] = await centre(people.alphaEditor);
        expect(notice).toMatchObject({
          categoryKey: NOTIFICATION_CATEGORY.REPORT_UPDATE,
          categoryName: 'Actualizări ale rapoartelor',
          title: 'Factorii de emisie ai raportului Brutăria Alpha pentru 2026 au fost înlocuiți',
          body: `Setul ${inForce.payload.label} a fost înlocuit de 2026.2. Recalculați emisiile pentru ca cifrele să folosească factorii în vigoare.`,
          actionLabel: 'Deschideți calculatorul',
          deepLink: `/reports/${alphaReport}/calculator`,
        });
        expect(await centre(people.alphaViewer)).toEqual([]);
      } finally {
        await publisher.revert({ ...SLOT, toRevision: inForce.revision });
        await store.poll();
      }

      // The revert replaced the correction with the set Alpha's run used, so its notice is withdrawn (row (5)).
      expect((await handleLatestReplacement()).enteringRevision).toBe(inForce.revision);
      const [cancelled] = await reportUpdates(NOTIFICATION_CANCELLED, ALPHA);
      expect(cancelled.payload).toMatchObject({ subjectRef: `factor-set:md:${inForce.revision}` });
      expect(store.get({ ...SLOT, on: '2026-01-01' })?.revision).toBe(inForce.revision);
    });
  });

  /** The worker's notification consumer over its own role, delivering one committed raise as the dispatcher would. */
  const deliver = async (row: OutboxRow): Promise<void> => {
    const categories = new ConfigurationStore(application);
    await categories.refreshIfStale();
    const handler = new NotificationRaisedHandler(
      new DeliverNotification(
        new NotificationRecipientsRepository(worker),
        new EmailChannelService({ send: () => Promise.resolve({}) }, suppressionStore(worker)),
        new CategoryChannels(new NotificationCategoryCatalog(categories)),
        notificationStore(worker),
        'https://app.easyesg.md',
        new NotificationCategoryCatalog(categories),
        optOuts(worker),
        unsubscribeTokens(),
        { publish: () => Promise.resolve() },
      ),
    );
    await handler.handle(asJob(row), { jobId: row.idempotency_key, jobName: NOTIFICATION_RAISED, attempt: 1 });
  };

  const centre = async (who: SignedInAccount): Promise<Record<string, unknown>[]> =>
    ((await http().get('/api/v1/notifications').set(who.authorization).set('Accept-Language', 'ro').expect(200))
      .body as { objects: Record<string, unknown>[] }).objects;
});
