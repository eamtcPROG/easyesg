import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import type { EmailDispatched, EmailMessage, EmailPort } from '../src/contracts/email.port';
import { NOTIFICATION_CATEGORY } from '../src/contracts/notification.port';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { PROBLEM_BASE_URI } from '../src/app/filters/problem-types';
import { ConfigurationStore } from '../src/infrastructure/configuration/configuration-store.service';
import { seedConfiguration } from '../src/infrastructure/configuration/seed-configuration';
import { NotificationRecipientsRepository } from '../src/infrastructure/persistence/identity/notification-recipients.repository';
import { configureHttpApp } from '../src/main.http';
import { REMINDER_NOTE_MAX_LENGTH } from '../src/modules/core/disclosure/models/report-reminder.model';
import { MEMBERSHIP_ROLE } from '../src/modules/identity/membership/models/membership.model';
import { NotificationRaisedHandler } from '../src/modules/platform/notification/consumers/notification-raised.handler';
import { NOTIFICATION_RAISED } from '../src/modules/platform/notification/constants/notification.constants';
import { CategoryChannels } from '../src/modules/platform/notification/services/category-channels.service';
import { EmailChannelService } from '../src/modules/platform/notification/services/email-channel.service';
import { NotificationCategoryCatalog } from '../src/modules/platform/notification/services/notification-category-catalog.service';
import { DeliverNotification } from '../src/modules/platform/notification/use-cases/deliver-notification.use-case';
import { asOrganization, connectAs } from './support/database';
import { asJob, deleteNotificationsOf, notificationStore, optOuts, unsubscribeTokens, suppressionStore, OCCURRED_MICROS } from './support/notification-store';
import { cleanupSignedInAccounts, signInFreshAccount, type SignedInAccount } from './support/signed-in-account';

/**
 * UC-175's manual reminder, end to end on the stack (task 50.3; `architecture.md` §12.5.6's task-50.3 row): an
 * administrator's `POST /reports/{id}/reminders`, the raise it commits, the worker's delivery of that raise, and the
 * member's centre reading it back in words.
 *
 * **The worker's half is driven by hand**, as `notification-dispatch.e2e-spec.ts` drives it: the outbox row the
 * request committed is handed to the notification consumer as the dispatcher would enqueue it, over the worker's own
 * role. What that proves and a unit spec cannot is the join of the halves — the producer's parameters and the
 * catalogue's words agreeing, the category's artefact deciding its channels (in-app, and by email since task 52.2.2),
 * and the centre's policies showing the
 * reminder to its recipient.
 */
const ORG = '01930000-0000-7000-8000-0000000005e1';
const SUITE = 'reminders.test';
const EMAILS = {
  admin: `oa@${SUITE}`,
  editor: `rc@${SUITE}`,
  viewer: `vo@${SUITE}`,
  removed: `rm@${SUITE}`,
};
const CHISINAU = 'Europe/Chisinau';
const NOTE = 'Mai lipsesc datele despre consumul de energie.';

class RecordingEmailPort implements EmailPort {
  readonly sent: EmailMessage[] = [];

  send(message: EmailMessage): Promise<EmailDispatched> {
    this.sent.push(message);
    return Promise.resolve({});
  }
}

interface OutboxRow {
  organization_id: string | null;
  occurred_micros: string;
  idempotency_key: string;
  payload: Record<string, unknown>;
}

interface Item {
  id: string;
  categoryKey: string;
  categoryName?: string;
  title?: string;
  body?: string;
  actionLabel?: string;
  deepLink: string;
  readAt: number | null;
}

describe('the manual reminder (UC-175, task 50.3)', () => {
  let app: NestExpressApplication;
  let owner: DataSource;
  let worker: DataSource;
  let application: DataSource;

  let admin: SignedInAccount;
  let editor: SignedInAccount;
  let viewer: SignedInAccount;
  let removed: SignedInAccount;
  const membershipOf: Record<string, string> = {};
  let openReport: string;
  let lockedReport: string;

  const http = () => request(app.getHttpServer());
  const problemOf = (body: unknown): string => (body as { type: string }).type;

  const remind = (input: { reportId: string; membershipId: string; note?: string; as?: SignedInAccount }) =>
    http()
      .post(`/api/v1/reports/${input.reportId}/reminders`)
      .set((input.as ?? admin).authorization)
      .send(input.note === undefined ? { membershipId: input.membershipId } : { membershipId: input.membershipId, note: input.note });

  /** The reminders this organization's outbox holds, oldest first — what the worker would be handed. */
  const raised = async (): Promise<OutboxRow[]> =>
    worker.query(
      `SELECT organization_id, ${OCCURRED_MICROS}, idempotency_key, payload
         FROM audit.outbox_event
        WHERE event_type = $1 AND organization_id = $2 AND payload->>'categoryKey' = $3
        ORDER BY occurred_at, idempotency_key`,
      [NOTIFICATION_RAISED, ORG, NOTIFICATION_CATEGORY.MANUAL_REMINDER],
    );

  /** The worker's consumer over its own role, delivering one committed raise as the dispatcher would. */
  const email = new RecordingEmailPort();
  const deliver = async (row: OutboxRow): Promise<void> => {
    const store = new ConfigurationStore(application);
    await store.refreshIfStale();
    const handler = new NotificationRaisedHandler(
      new DeliverNotification(
        new NotificationRecipientsRepository(worker),
        new EmailChannelService(email, suppressionStore(worker)),
        new CategoryChannels(new NotificationCategoryCatalog(store)),
        notificationStore(worker),
        'https://app.easyesg.md',
        new NotificationCategoryCatalog(store),
        optOuts(worker),
        unsubscribeTokens(),
        // AD-15's hint (task 148) is `push-hints.e2e-spec.ts`'s subject; here it goes nowhere.
        { publish: () => Promise.resolve() },
      ),
    );
    await handler.handle(asJob(row), { jobId: row.idempotency_key, jobName: NOTIFICATION_RAISED, attempt: 1 });
  };

  const centre = async (who: SignedInAccount, language = 'ro'): Promise<Item[]> =>
    ((await http().get('/api/v1/notifications').set(who.authorization).set('Accept-Language', language).expect(200))
      .body as { objects: Item[] }).objects;

  /** A period for the year, opened by the administrator, and its report created — returning the report's id. */
  const reportFor = async (year: number): Promise<{ periodId: string; reportId: string }> => {
    const period = await http()
      .post('/api/v1/periods')
      .set(admin.authorization)
      .send({
        reportingEntityId: entityId,
        fiscalYear: year,
        periodStart: { date: `${year}-01-01`, timezone: CHISINAU },
        periodEnd: { date: `${year}-12-31`, timezone: CHISINAU },
      })
      .expect(201);
    const periodId = (period.body as { object: { id: string } }).object.id;
    const report = await http()
      .post('/api/v1/reports')
      .set(admin.authorization)
      .send({ reportingPeriodId: periodId })
      .expect(201);
    return { periodId, reportId: (report.body as { object: { id: string } }).object.id };
  };
  let entityId: string;

  const cleanup = async () => {
    await owner.query(`DELETE FROM audit.outbox_event WHERE organization_id = $1`, [ORG]);
    await deleteNotificationsOf(owner, ORG);
    await asOrganization(owner, ORG, (run) => run(`DELETE FROM core.organization WHERE id = $1`, [ORG]));
    // A preference hangs off no organization and nothing cascades to it (task 52.2.1): what this suite creates, it removes.
    await owner.query(
      `DELETE FROM notification.preference
        WHERE account_id IN (SELECT id FROM identity.account WHERE email = ANY($1))`,
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

    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', 'easyesg-reminders-owner');
    worker = await connectAs('DB_WORKER_USER', 'DB_WORKER_PASSWORD', 'easyesg-reminders-worker');
    application = await connectAs('DB_USER', 'DB_PASSWORD', 'easyesg-reminders-app');
    // The suite seeds what it reads: the category's artefact decides the channels.
    await seedConfiguration(application);
    await cleanup();
    await asOrganization(owner, null, (run) =>
      run(`INSERT INTO core.organization (id, name, country_code) VALUES ($1, 'Lina SRL', 'MD')`, [ORG]),
    );

    const server = app.getHttpServer();
    admin = await signInFreshAccount({ server, worker, email: EMAILS.admin });
    editor = await signInFreshAccount({ server, worker, email: EMAILS.editor });
    viewer = await signInFreshAccount({ server, worker, email: EMAILS.viewer });
    removed = await signInFreshAccount({ server, worker, email: EMAILS.removed });
    for (const [account, role, status] of [
      [admin, MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR, 'active'],
      [editor, MEMBERSHIP_ROLE.EDITOR, 'active'],
      [viewer, MEMBERSHIP_ROLE.VIEWER, 'active'],
      [removed, MEMBERSHIP_ROLE.EDITOR, 'removed'],
    ] as const) {
      const [row] = await asOrganization(owner, ORG, (run) =>
        run(
          `INSERT INTO identity.membership (account_id, organization_id, role, status, removed_at)
           VALUES ($1, $2, $3, $4, CASE WHEN $4 = 'removed' THEN now() END) RETURNING id`,
          [account.accountId, ORG, role, status],
        ) as Promise<{ id: string }[]>,
      );
      membershipOf[account.accountId] = row.id;
    }

    const entity = await http()
      .post('/api/v1/entities')
      .set(admin.authorization)
      .send({
        name: 'Brutăria Lina',
        legalForm: 'srl',
        naceCodes: ['10.71'],
        sites: [{ name: 'Fabrica Chișinău', locality: 'Chișinău', countryCode: 'MD' }],
      })
      .expect(201);
    entityId = (entity.body as { object: { id: string } }).object.id;

    openReport = (await reportFor(2026)).reportId;
    const locked = await reportFor(2025);
    lockedReport = locked.reportId;
    await http().post(`/api/v1/periods/${locked.periodId}/lock`).set(admin.authorization).expect(200);
  }, 180_000);

  afterAll(async () => {
    await cleanupSignedInAccounts({ owner });
    if (owner) await cleanup();
    await app?.close();
    for (const source of [owner, worker, application]) if (source?.isInitialized) await source.destroy();
  });

  it("reaches the member's centre and their inbox in their language, the email carrying its unsubscribe", async () => {
    await remind({ reportId: openReport, membershipId: membershipOf[viewer.accountId], note: NOTE }).expect(202);

    const [row] = await raised();
    expect(row.payload).toMatchObject({
      categoryKey: 'reporting.manual_reminder',
      recipientUserIds: [viewer.accountId],
      deepLink: `/reports/${openReport}`,
    });
    await deliver(row);

    const [item] = await centre(viewer);
    expect(item).toMatchObject({
      categoryKey: 'reporting.manual_reminder',
      categoryName: 'Mementouri',
      title: 'Ana Popescu vă reamintește de raportul Brutăria Lina pentru 2026',
      body: `„${NOTE}”`,
      actionLabel: 'Deschideți raportul',
      deepLink: `/reports/${openReport}`,
      readAt: null,
    });
    // The same notice in the reader's other language, resolved per request (the task-50.1 row's (10)).
    const [inRussian] = await centre(viewer, 'ru');
    expect(inRussian.title).toBe('Ana Popescu напоминает вам об отчёте Brutăria Lina за 2026 год');
    // By email too since task 52.2.2, and — an optional category — with FR-169's one-click unsubscribe, signed for this
    // reader and this category, which the api's own public route reads back.
    expect(email.sent).toHaveLength(1);
    const [sent] = email.sent;
    expect(sent).toMatchObject({ to: EMAILS.viewer, templateKey: 'reporting.manual_reminder' });
    const token = sent.unsubscribe?.link.split('/unsubscribe/')[1] ?? '';
    expect(sent.unsubscribe?.oneClickUrl?.endsWith(`/mail/unsubscribe/${token}`)).toBe(true);
    const preview = await http()
      .post('/api/v1/account/notification-preferences/unsubscribe/preview')
      .send({ token })
      .expect(200);
    expect((preview.body as { object: unknown }).object).toMatchObject({
      standing: 'available',
      categoryKey: 'reporting.manual_reminder',
    });
    // And to nobody else: the sender's own centre holds none of it.
    expect(await centre(admin)).toEqual([]);
  });

  it('makes a second press a second notice, whose own words say no note was given', async () => {
    await remind({ reportId: openReport, membershipId: membershipOf[viewer.accountId] }).expect(202);

    const rows = await raised();
    expect(rows).toHaveLength(2);
    expect(rows[1].payload.subjectRef).not.toBe(rows[0].payload.subjectRef);
    await deliver(rows[1]);

    const items = await centre(viewer);
    expect(items).toHaveLength(2);
    expect(items[0].body).toBe('Deschideți raportul pentru a vedea ce a mai rămas de completat.');
  });

  it('reaches an editor too — any active member but the sender', async () => {
    await remind({ reportId: openReport, membershipId: membershipOf[editor.accountId] }).expect(202);
    expect(await raised()).toHaveLength(3);
  });

  it('keeps a reminder from the centre of a member who switched reminders off there, and records why (task 52.2.1)', async () => {
    await http()
      .put('/api/v1/account/notification-preferences')
      .set(editor.authorization)
      .send({ switchedOff: [{ categoryKey: 'reporting.manual_reminder', channel: 'in_app' }] })
      .expect(200);

    const row = (await raised())[2];
    expect(row.payload.recipientUserIds).toEqual([editor.accountId]);
    await deliver(row);

    expect(await centre(editor)).toEqual([]);
    const deliveries = (await asOrganization(owner, ORG, (run) =>
      run(
        `SELECT notification_id, channel, outcome FROM notification.delivery
          WHERE recipient_account_id = $1 ORDER BY channel`,
        [editor.accountId],
      ),
    )) as { notification_id: string; channel: string; outcome: string }[];
    // Switched off in-app alone, so the email still goes (task 52.2.2 published it): one choice, one channel.
    expect(deliveries.map(({ channel, outcome }) => ({ channel, outcome }))).toEqual([
      { channel: 'email', outcome: 'accepted' },
      { channel: 'in_app', outcome: 'opted_out' },
    ]);

    // A notice the member chose not to receive is not one they can read: the centre answers it as not theirs, and the
    // database refuses the marker to any writer (`delivery_read_state_delivered_only`).
    const [{ notification_id: notificationId }] = deliveries;
    await http().post(`/api/v1/notifications/${notificationId}/read`).set(editor.authorization).expect(404);
    await expect(
      asOrganization(owner, ORG, (run) =>
        // The in-app row alone: the email row breaks the rule on its own, and would prove nothing about opted_out (task 52's
        // close review).
        run(`UPDATE notification.delivery SET read_at = now()
              WHERE notification_id = $1 AND recipient_account_id = $2 AND channel = 'in_app'`, [
          notificationId,
          editor.accountId,
        ]),
      ),
    ).rejects.toThrow('delivery_read_state_delivered_only');
  });

  it.each([
    ['from an editor, who is not the administrator', () => ({ as: editor, reportId: openReport, membershipId: membershipOf[viewer.accountId] }), 403, 'insufficient-role'],
    ['to its own sender', () => ({ reportId: openReport, membershipId: membershipOf[admin.accountId] }), 409, 'conflict'],
    ['to a removed member', () => ({ reportId: openReport, membershipId: membershipOf[removed.accountId] }), 404, 'not-found'],
    ['about a locked report', () => ({ reportId: lockedReport, membershipId: membershipOf[viewer.accountId] }), 409, 'conflict'],
    ['about a report no organization holds', () => ({ reportId: '01930000-0000-7000-8000-00000000ffff', membershipId: membershipOf[viewer.accountId] }), 404, 'not-found'],
    ['with a note past its bound', () => ({ reportId: openReport, membershipId: membershipOf[viewer.accountId], note: 'a'.repeat(REMINDER_NOTE_MAX_LENGTH + 1) }), 400, 'validation-failed'],
  ])('refuses a reminder %s, and raises nothing', async (_case, input, status, type) => {
    const before = (await raised()).length;

    const response = await remind(input()).expect(status);

    expect(problemOf(response.body)).toBe(`${PROBLEM_BASE_URI}/${type}`);
    expect(await raised()).toHaveLength(before);
  });
});
