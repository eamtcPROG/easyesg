import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import { SOURCE_LOCALE } from '@easyesg/i18n';
import type { EmailDispatched, EmailMessage, EmailPort } from '../src/contracts/email.port';
import { NOTIFICATION_CATEGORY } from '../src/contracts/notification.port';
import { ConfigurationStore } from '../src/infrastructure/configuration/configuration-store.service';
import { seedConfiguration } from '../src/infrastructure/configuration/seed-configuration';
import { NotificationRecipientsRepository } from '../src/infrastructure/persistence/identity/notification-recipients.repository';
import { NotificationOutboxRepository } from '../src/infrastructure/persistence/platform/notification-outbox.repository';
import { runInRequestContext } from '../src/infrastructure/persistence/request-context';
import { NotificationRaisedHandler } from '../src/modules/platform/notification/consumers/notification-raised.handler';
import { NOTIFICATION_RAISED } from '../src/modules/platform/notification/constants/notification.constants';
import { CategoryChannels } from '../src/modules/platform/notification/services/category-channels.service';
import { EmailChannelService } from '../src/modules/platform/notification/services/email-channel.service';
import { NotificationCategoryCatalog } from '../src/modules/platform/notification/services/notification-category-catalog.service';
import { DeliverNotification } from '../src/modules/platform/notification/use-cases/deliver-notification.use-case';
import { connectAs } from './support/database';
import { asJob, deleteNotificationsOf, notificationStore, optOuts, unsubscribeTokens, suppressionStore, OCCURRED_MICROS } from './support/notification-store';

/**
 * **A notification raised and dispatched by category through the outbox** — task 49.3's expected result, over the
 * real grants, a real transaction, real accounts and the seeded catalogue (AD-11, P-8, FR-169).
 *
 * The claims only a database can hold: the notice commits **with the producer's transaction or not at all**, so a
 * rolled-back decision leaves no notice behind; the row carries what the producer named and **no address**; and the
 * worker, as `esg_worker`, resolves each recipient's address and language from their account at send time.
 *
 * The consumer is constructed directly rather than by booting a worker, `registration.e2e-spec.ts`'s reasoning —
 * `MODE` is read at module-definition time, so one process cannot host both halves — and a recording provider is
 * what lets each message be asserted rather than inferred from a log line.
 */
const SUITE = 'task49-3';
const ORG = randomUUID();
const addressFor = (label: string) => `${SUITE}-${label}@example.md`;

class RecordingEmailPort implements EmailPort {
  readonly sent: EmailMessage[] = [];

  send(message: EmailMessage): Promise<EmailDispatched> {
    this.sent.push(message);
    return Promise.resolve({});
  }
}

interface OutboxRow {
  event_type: string;
  organization_id: string | null;
  occurred_micros: string;
  idempotency_key: string;
  payload: Record<string, unknown>;
}

describe('a notification raised and dispatched by category (task 49.3)', () => {
  let app: DataSource;
  let owner: DataSource;
  let worker: DataSource;
  let ana: string;
  let ivan: string;

  beforeAll(async () => {
    app = await connectAs('DB_USER', 'DB_PASSWORD', `easyesg-${SUITE}-app`);
    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', `easyesg-${SUITE}-owner`);
    worker = await connectAs('DB_WORKER_USER', 'DB_WORKER_PASSWORD', `easyesg-${SUITE}-worker`);
    // The suite seeds what it reads: the catalogue decides the channels.
    await seedConfiguration(app);

    const account = async (label: string, locale: string): Promise<string> => {
      const rows: { id: string }[] = await owner.query(
        `INSERT INTO identity.account (email, locale) VALUES ($1, $2) RETURNING id`,
        [addressFor(label), locale],
      );
      return rows[0].id;
    };
    ana = await account('ana', 'ro');
    ivan = await account('ivan', 'ru');
  }, 30_000);

  afterAll(async () => {
    await owner?.query(`DELETE FROM audit.outbox_event WHERE event_type = $1 AND organization_id = $2`, [
      NOTIFICATION_RAISED,
      ORG,
    ]);
    if (owner) await deleteNotificationsOf(owner, ORG);
    await owner?.query(`DELETE FROM identity.account WHERE email LIKE $1`, [`${SUITE}-%@example.md`]);
    for (const source of [app, owner, worker]) if (source?.isInitialized) await source.destroy();
  });

  /** A producer's transaction, as a tenant request holds one, with `raise()` called inside it. */
  const raiseWithin = async (input: {
    readonly recipientUserIds: readonly string[];
    readonly subjectRef: string;
    readonly commit: boolean;
  }): Promise<string> => {
    const runner = app.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await runner.query('SELECT set_config($1, $2, true)', ['app.current_org', ORG]);
      const { notificationId } = await runInRequestContext(
        { correlationId: randomUUID(), locale: SOURCE_LOCALE, organizationId: ORG, queryRunner: runner },
        () =>
          new NotificationOutboxRepository().raise({
            categoryKey: NOTIFICATION_CATEGORY.INVITATION,
            organizationId: ORG,
            recipientUserIds: [...input.recipientUserIds],
            subjectRef: input.subjectRef,
            deepLink: '/invitation/abc',
            params: { organizationName: 'Brutăria' },
          }),
      );
      if (input.commit) await runner.commitTransaction();
      else await runner.rollbackTransaction();
      return notificationId;
    } finally {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      await runner.release();
    }
  };

  const outboxRow = async (notificationId: string): Promise<OutboxRow | undefined> => {
    const rows: OutboxRow[] = await worker.query(
      `SELECT event_type, organization_id, ${OCCURRED_MICROS}, idempotency_key, payload
         FROM audit.outbox_event WHERE idempotency_key = $1`,
      [notificationId],
    );
    return rows[0];
  };

  it("commits the notice with the producer's transaction, naming users and carrying no address", async () => {
    const notificationId = await raiseWithin({
      recipientUserIds: [ana, ivan],
      subjectRef: `${SUITE}:committed`,
      commit: true,
    });

    const row = await outboxRow(notificationId);
    expect(row).toMatchObject({ event_type: NOTIFICATION_RAISED, organization_id: ORG });
    expect(row?.payload).toMatchObject({
      categoryKey: 'identity.invitation',
      recipientUserIds: [ana, ivan],
      deepLink: '/invitation/abc',
    });
    expect(JSON.stringify(row?.payload)).not.toContain('@example.md');
  });

  it('leaves no notice behind when the decision that raised it rolls back', async () => {
    const notificationId = await raiseWithin({
      recipientUserIds: [ana],
      subjectRef: `${SUITE}:rolled-back`,
      commit: false,
    });

    expect(await outboxRow(notificationId)).toBeUndefined();
  });

  it('delivers it by the category, to each account as it stands, in its own language', async () => {
    const nobody = randomUUID();
    const notificationId = await raiseWithin({
      recipientUserIds: [ana, ivan, nobody],
      subjectRef: `${SUITE}:delivered`,
      commit: true,
    });
    const row = await outboxRow(notificationId);
    if (!row) throw new Error('the raised notice left no outbox row');

    const store = new ConfigurationStore(app);
    await store.refreshIfStale();
    const provider = new RecordingEmailPort();
    const handler = new NotificationRaisedHandler(
      new DeliverNotification(
        new NotificationRecipientsRepository(worker),
        new EmailChannelService(provider, suppressionStore(worker)),
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

    // What the dispatcher enqueues: the row's payload, with the row's organization and time beside it.
    await handler.handle(
      asJob(row),
      { jobId: row.idempotency_key, jobName: NOTIFICATION_RAISED, attempt: 1 },
    );

    expect(
      provider.sent
        .map((message) => ({
          to: message.to,
          locale: message.locale,
          templateKey: message.templateKey,
          link: message.params.link,
          key: message.idempotencyKey,
        }))
        .sort((a, b) => a.to.localeCompare(b.to)),
    ).toEqual([
      {
        to: addressFor('ana'),
        locale: 'ro',
        templateKey: 'identity.invitation',
        link: 'https://app.easyesg.md/ro/invitation/abc',
        key: `${notificationId}:${ana}`,
      },
      {
        to: addressFor('ivan'),
        locale: 'ru',
        templateKey: 'identity.invitation',
        link: 'https://app.easyesg.md/ru/invitation/abc',
        key: `${notificationId}:${ivan}`,
      },
    ]);
  });

  // A notice to nobody is a producer's defect: refused where it is raised, not carried to the worker to deliver nothing.
  it('refuses a notice that names no recipient, inside the transaction that raised it', async () => {
    await expect(
      raiseWithin({ recipientUserIds: [], subjectRef: `${SUITE}:nobody`, commit: true }),
    ).rejects.toThrow('names no recipient');
  });

  // One malformed id must not refuse the batch: `ANY($1::uuid[])` would, so it is never sent to the database.
  it('resolves the accounts a batch names and simply omits an id that is not a UUID', async () => {
    const found = await new NotificationRecipientsRepository(worker).resolve({
      userIds: [ana, 'not-a-uuid', ivan],
    });

    expect(found.map((recipient) => recipient.email).sort()).toEqual([addressFor('ana'), addressFor('ivan')]);
  });
});
