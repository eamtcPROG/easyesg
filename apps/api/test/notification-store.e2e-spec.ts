import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import { SOURCE_LOCALE } from '@easyesg/i18n';
import type { EmailDispatched, EmailMessage, EmailPort } from '../src/contracts/email.port';
import { NOTIFICATION_CATEGORY } from '../src/contracts/notification.port';
import { NotificationRecipientsRepository } from '../src/infrastructure/persistence/identity/notification-recipients.repository';
import { NotificationOutboxRepository } from '../src/infrastructure/persistence/platform/notification-outbox.repository';
import {
  NotificationStoreRepository,
  notificationKeyLockName,
} from '../src/infrastructure/persistence/platform/notification-store.repository';
import { runInRequestContext } from '../src/infrastructure/persistence/request-context';
import { NotificationCancelledHandler } from '../src/modules/platform/notification/consumers/notification-cancelled.handler';
import { NotificationRaisedHandler } from '../src/modules/platform/notification/consumers/notification-raised.handler';
import {
  NOTIFICATION_CANCELLED,
  NOTIFICATION_RAISED,
} from '../src/modules/platform/notification/constants/notification.constants';
import { EmailChannelService } from '../src/modules/platform/notification/services/email-channel.service';
import { CancelNotification } from '../src/modules/platform/notification/use-cases/cancel-notification.use-case';
import { DeliverNotification } from '../src/modules/platform/notification/use-cases/deliver-notification.use-case';
import { asOrganization, connectAs } from './support/database';
import { deleteNotificationsOf } from './support/notification-store';

/**
 * **The notification store** — task 50.1.1's expected result over the real schema, grants and policies: a raised
 * notice recorded once, delivered in-app and by email with a row per recipient and channel, and a repeated raise of
 * an open notice deduplicated (FR-160, FR-167, FR-168, FR-170).
 *
 * The claims only a database can hold, and so the ones this suite exists for: **the record adopts the outbox key**;
 * **the partial unique index makes two raises of one key one notice**, concurrently as well as in turn; **a job run
 * twice reaches nobody twice**, by the delivery's own uniqueness; and **the schema is the worker's** — invisible
 * across organizations and unreachable from the request tier. The channel decision is a stub answering both
 * channels, because the category catalogue's rules are 49.3's suite and no category travels in-app until 50.3.
 *
 * **Task 50.1.3's cancellation is proven here too**, over the same helpers: a producer's `cancel()` committed and
 * dispatched closes the key's open notice, and — the reason it records a time per key (§12.5.6's task-50.1 row (12))
 * — a raise dispatched *after* the cancellation that came after it opens nothing, whichever the workers took first.
 */
const SUITE = 'task50-1-1';
const ORG = randomUUID();
const OTHER_ORG = randomUUID();
const addressFor = (label: string) => `${SUITE}-${label}@example.md`;

class RecordingEmailPort implements EmailPort {
  readonly sent: EmailMessage[] = [];

  send(message: EmailMessage): Promise<EmailDispatched> {
    this.sent.push(message);
    return Promise.resolve({});
  }
}

interface NoticeRow {
  id: string;
  state: string;
  subject_ref: string;
  recipient_scope: string;
  delivered: boolean;
}

interface DeliveryRow {
  recipient_account_id: string;
  channel: string;
  outcome: string;
  read_at: Date | null;
}

describe('the notification store (tasks 50.1.1, 50.1.3)', () => {
  let app: DataSource;
  let owner: DataSource;
  let worker: DataSource;
  let ana: string;
  let ivan: string;
  let provider: RecordingEmailPort;
  let handler: NotificationRaisedHandler;
  let cancelledHandler: NotificationCancelledHandler;

  beforeAll(async () => {
    app = await connectAs('DB_USER', 'DB_PASSWORD', `easyesg-${SUITE}-app`);
    owner = await connectAs('DB_MIGRATOR_USER', 'DB_MIGRATOR_PASSWORD', `easyesg-${SUITE}-owner`);
    worker = await connectAs('DB_WORKER_USER', 'DB_WORKER_PASSWORD', `easyesg-${SUITE}-worker`);

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

  beforeEach(() => {
    provider = new RecordingEmailPort();
    handler = new NotificationRaisedHandler(
      new DeliverNotification(
        new NotificationRecipientsRepository(worker),
        new EmailChannelService(provider),
        { channelsFor: () => ['in_app', 'email'] },
        new NotificationStoreRepository(worker),
        'https://app.easyesg.md',
      ),
    );
    cancelledHandler = new NotificationCancelledHandler(
      new CancelNotification(new NotificationStoreRepository(worker)),
    );
  });

  afterAll(async () => {
    await owner?.query(`DELETE FROM audit.outbox_event WHERE event_type = ANY($1) AND organization_id = $2`, [
      [NOTIFICATION_RAISED, NOTIFICATION_CANCELLED],
      ORG,
    ]);
    if (owner) await deleteNotificationsOf(owner, ORG);
    await owner?.query(`DELETE FROM identity.account WHERE email LIKE $1`, [`${SUITE}-%@example.md`]);
    for (const source of [app, owner, worker]) if (source?.isInitialized) await source.destroy();
  });

  /** A producer's committed transaction, as a tenant request holds one, with `work` called inside it. */
  const committed = async <T>(work: (port: NotificationOutboxRepository) => Promise<T>): Promise<T> => {
    const runner = app.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await runner.query('SELECT set_config($1, $2, true)', ['app.current_org', ORG]);
      const result = await runInRequestContext(
        { correlationId: randomUUID(), locale: SOURCE_LOCALE, organizationId: ORG, queryRunner: runner },
        () => work(new NotificationOutboxRepository()),
      );
      await runner.commitTransaction();
      return result;
    } finally {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      await runner.release();
    }
  };

  /** A committed `raise()` — the outbox row the dispatcher would enqueue — answering its key. */
  const raise = async (input: { readonly recipientUserIds: string[]; readonly subjectRef: string }) =>
    (
      await committed((port) =>
        port.raise({
          categoryKey: NOTIFICATION_CATEGORY.INVITATION,
          organizationId: ORG,
          recipientUserIds: input.recipientUserIds,
          subjectRef: input.subjectRef,
          deepLink: '/invitation/abc',
          params: { organizationName: 'Brutăria' },
        }),
      )
    ).notificationId;

  /** A committed `cancel()` of the same category and default audience, answering its outbox key. */
  const cancel = async (subjectRef: string): Promise<string> => {
    await committed((port) =>
      port.cancel({ categoryKey: NOTIFICATION_CATEGORY.INVITATION, organizationId: ORG, subjectRef }),
    );
    const [row] = await worker.query<{ idempotency_key: string }[]>(
      `SELECT idempotency_key FROM audit.outbox_event
        WHERE event_type = $1 AND organization_id = $2 AND payload->>'subjectRef' = $3
        ORDER BY occurred_at DESC LIMIT 1`,
      [NOTIFICATION_CANCELLED, ORG, subjectRef],
    );
    return row.idempotency_key;
  };

  /**
   * The job the dispatcher would hand the worker for that row — its payload, with the row's organization and time
   * beside it — to the handler its event type names.
   */
  const dispatch = async (outboxKey: string): Promise<void> => {
    const rows: {
      event_type: string;
      payload: Record<string, unknown>;
      organization_id: string;
      occurred_at: Date;
    }[] = await worker.query(
      `SELECT event_type, payload, organization_id, occurred_at FROM audit.outbox_event WHERE idempotency_key = $1`,
      [outboxKey],
    );
    const [row] = rows;
    const job = { ...row.payload, organizationId: row.organization_id, occurredAt: row.occurred_at.getTime() };
    const context = { jobId: outboxKey, jobName: row.event_type, attempt: 1 };
    await (row.event_type === NOTIFICATION_CANCELLED ? cancelledHandler : handler).handle(job, context);
  };

  const stateOf = async (notificationId: string): Promise<string | undefined> =>
    (
      (await asOrganization(worker, ORG, (run) =>
        run(`SELECT state FROM notification.notification WHERE id = $1`, [notificationId]),
      )) as { state: string }[]
    )[0]?.state;

  const noticesAbout = (subjectRef: string) =>
    asOrganization(
      worker,
      ORG,
      (run) =>
        run(
          `SELECT id, state, subject_ref, recipient_scope, delivered_at IS NOT NULL AS delivered
             FROM notification.notification WHERE subject_ref = $1`,
          [subjectRef],
        ) as Promise<NoticeRow[]>,
    );

  const deliveriesOf = (notificationId: string) =>
    asOrganization(
      worker,
      ORG,
      (run) =>
        run(
          `SELECT recipient_account_id, channel, outcome, read_at FROM notification.delivery
            WHERE notification_id = $1 ORDER BY recipient_account_id, channel`,
          [notificationId],
        ) as Promise<DeliveryRow[]>,
    );

  const byRecipient = (rows: DeliveryRow[]) =>
    rows
      .map((row) => `${row.recipient_account_id === ana ? 'ana' : 'ivan'}:${row.channel}:${row.outcome}`)
      .sort();

  it('records a raised notice once, under its outbox key, with a delivery per recipient and channel', async () => {
    const outboxKey = await raise({ recipientUserIds: [ana, ivan], subjectRef: `${SUITE}:recorded` });
    await dispatch(outboxKey);

    expect(await noticesAbout(`${SUITE}:recorded`)).toEqual([
      {
        id: outboxKey,
        state: 'delivered',
        subject_ref: `${SUITE}:recorded`,
        recipient_scope: 'default',
        delivered: true,
      },
    ]);
    const deliveries = await deliveriesOf(outboxKey);
    expect(byRecipient(deliveries)).toEqual([
      'ana:email:accepted',
      'ana:in_app:delivered',
      'ivan:email:accepted',
      'ivan:in_app:delivered',
    ]);
    // FR-161's read state starts unread for each recipient, on their own row.
    expect(deliveries.every((row) => row.read_at === null)).toBe(true);
    expect(provider.sent.map((message) => message.idempotencyKey).sort()).toEqual(
      [`${outboxKey}:${ana}`, `${outboxKey}:${ivan}`].sort(),
    );
  });

  it('reaches nobody twice when the same job runs again', async () => {
    const outboxKey = await raise({ recipientUserIds: [ana, ivan], subjectRef: `${SUITE}:rerun` });
    await dispatch(outboxKey);
    const sentOnce = provider.sent.length;

    await dispatch(outboxKey);

    expect(provider.sent).toHaveLength(sentOnce);
    expect(await deliveriesOf(outboxKey)).toHaveLength(4);
    expect(await noticesAbout(`${SUITE}:rerun`)).toHaveLength(1);
  });

  it('folds a second raise of an open notice into it, reaching only the recipient it adds', async () => {
    const first = await raise({ recipientUserIds: [ana], subjectRef: `${SUITE}:folded` });
    await dispatch(first);
    const second = await raise({ recipientUserIds: [ana, ivan], subjectRef: `${SUITE}:folded` });
    provider.sent.length = 0;

    await dispatch(second);

    expect((await noticesAbout(`${SUITE}:folded`)).map((notice) => notice.id)).toEqual([first]);
    expect(byRecipient(await deliveriesOf(first))).toEqual([
      'ana:email:accepted',
      'ana:in_app:delivered',
      'ivan:email:accepted',
      'ivan:in_app:delivered',
    ]);
    expect(provider.sent.map((message) => message.idempotencyKey)).toEqual([`${first}:${ivan}`]);
  });

  /**
   * Row (6)'s other half, and the redelivery rule `open` states: a cancelled notice no longer holds its key, so the
   * next raise opens a new one — and a job for the cancelled notice, run again, finds its own notice by id rather
   * than joining the new one. The cancellation is written directly, as the worker, because task 50.1.3 is what
   * writes one in the product.
   */
  it('opens a new notice after a cancellation, and delivers nothing more for the cancelled one', async () => {
    const cancelled = await raise({ recipientUserIds: [ana], subjectRef: `${SUITE}:cancelled` });
    await dispatch(cancelled);
    await asOrganization(worker, ORG, (run) =>
      run(`UPDATE notification.notification SET state = 'cancelled', cancelled_at = now() WHERE id = $1`, [
        cancelled,
      ]),
    );

    const reopened = await raise({ recipientUserIds: [ivan], subjectRef: `${SUITE}:cancelled` });
    await dispatch(reopened);
    provider.sent.length = 0;
    await dispatch(cancelled);

    const notices = await noticesAbout(`${SUITE}:cancelled`);
    expect(notices.map((notice) => [notice.id, notice.state]).sort()).toEqual(
      [
        [cancelled, 'cancelled'],
        [reopened, 'delivered'],
      ].sort(),
    );
    expect(provider.sent).toEqual([]);
    expect(byRecipient(await deliveriesOf(reopened))).toEqual(['ivan:email:accepted', 'ivan:in_app:delivered']);
  });

  // ── Task 50.1.3: cancellation ──────────────────────────────────────────────────────────────────────────

  it("closes the key's open notice, which then delivers nothing more", async () => {
    const opened = await raise({ recipientUserIds: [ana], subjectRef: `${SUITE}:withdrawn` });
    await dispatch(opened);
    await dispatch(await cancel(`${SUITE}:withdrawn`));

    expect(await stateOf(opened)).toBe('cancelled');
    provider.sent.length = 0;
    // A redelivered job for it, naming someone new: the notice is cancelled, so no one is reached.
    await dispatch(opened);
    expect(provider.sent).toEqual([]);
  });

  // Row (12): the case the per-key time exists for — the cancellation reaches a worker first.
  it('opens nothing for a raise whose cancellation the workers applied first', async () => {
    const stale = await raise({ recipientUserIds: [ana], subjectRef: `${SUITE}:overtaken` });
    await dispatch(await cancel(`${SUITE}:overtaken`));

    await dispatch(stale);

    expect(provider.sent).toEqual([]);
    expect(await noticesAbout(`${SUITE}:overtaken`)).toEqual([]);

    // A raise made after the cancellation is the condition recurring, and opens a new notice.
    const recurred = await raise({ recipientUserIds: [ana], subjectRef: `${SUITE}:overtaken` });
    await dispatch(recurred);
    expect(await stateOf(recurred)).toBe('delivered');
  });

  // A notice raised again after a cancellation was made found its condition outstanding again.
  it('leaves open a notice whose latest raise came after the cancellation', async () => {
    const opened = await raise({ recipientUserIds: [ana], subjectRef: `${SUITE}:raised-again` });
    await dispatch(opened);
    const withdrawal = await cancel(`${SUITE}:raised-again`);
    const again = await raise({ recipientUserIds: [ana, ivan], subjectRef: `${SUITE}:raised-again` });
    await dispatch(again);

    await dispatch(withdrawal);

    expect(await stateOf(opened)).toBe('delivered');
  });

  // The key's time moves forward only: an older cancellation arriving late must not reopen the window it closed.
  it("keeps a key's latest cancellation when an older one is applied after it", async () => {
    const earlier = await cancel(`${SUITE}:twice`);
    const between = await raise({ recipientUserIds: [ana], subjectRef: `${SUITE}:twice` });
    const later = await cancel(`${SUITE}:twice`);

    await dispatch(later);
    await dispatch(earlier);
    await dispatch(between);

    expect(await noticesAbout(`${SUITE}:twice`)).toEqual([]);
    expect(provider.sent).toEqual([]);
  });

  /**
   * **The key's lock, shown rather than raced.** An older raise and a newer cancellation running at once each need
   * to see the other's commit, which only holds if both take the key's lock before reading. A race cannot be shown
   * absent by running it — without the lock this case's first version passed three runs in three — so the lock is
   * taken here from outside, and both operations are shown to wait for it and then finish.
   */
  it('makes an open and a cancellation of one key wait on the same lock', async () => {
    const store = new NotificationStoreRepository(worker);
    const key = {
      organizationId: ORG,
      categoryKey: NOTIFICATION_CATEGORY.INVITATION,
      subjectRef: `${SUITE}:locked`,
      recipientScope: 'default',
    };
    const holder = worker.createQueryRunner();
    await holder.connect();
    await holder.startTransaction();
    await holder.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [notificationKeyLockName(key)]);

    const settled: string[] = [];
    const waiting = [
      store
        .open({ ...key, notificationId: randomUUID(), raisedAt: new Date(), deepLink: '/invitation/abc', params: {} })
        .then(() => settled.push('open')),
      store.cancel({ ...key, cancelledAt: new Date() }).then(() => settled.push('cancel')),
    ];
    // Unlocked, both statements answer in milliseconds; a fifth of a second of silence is the lock holding them.
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(settled).toEqual([]);

    await holder.commitTransaction();
    await holder.release();
    await Promise.all(waiting);
    expect([...settled].sort()).toEqual(['cancel', 'open']);
  });

  // The index, not a read-then-write, is what makes this one notice: each open runs on its own connection.
  it('makes two concurrent raises of one key one notice', async () => {
    const store = new NotificationStoreRepository(worker);
    const opening = (notificationId: string) =>
      store.open({
        notificationId,
        organizationId: ORG,
        categoryKey: NOTIFICATION_CATEGORY.INVITATION,
        subjectRef: `${SUITE}:concurrent`,
        recipientScope: 'default',
        raisedAt: new Date(),
        deepLink: '/invitation/abc',
        params: {},
      });

    const [one, two] = await Promise.all([opening(randomUUID()), opening(randomUUID())]);

    expect(one.notificationId).toBe(two.notificationId);
    expect(await noticesAbout(`${SUITE}:concurrent`)).toHaveLength(1);
  });

  it('shows a notice to its own organization only, and refuses a delivery written under another', async () => {
    const outboxKey = await raise({ recipientUserIds: [ana], subjectRef: `${SUITE}:isolated` });
    await dispatch(outboxKey);

    const seenElsewhere = await asOrganization(worker, OTHER_ORG, (run) =>
      run(`SELECT id FROM notification.notification WHERE id = $1`, [outboxKey]),
    );
    expect(seenElsewhere).toEqual([]);

    await expect(
      asOrganization(worker, OTHER_ORG, (run) =>
        run(
          `INSERT INTO notification.delivery (notification_id, organization_id, recipient_account_id, channel, outcome)
           VALUES ($1, $2, $3, 'email', 'accepted')`,
          [outboxKey, ORG, ivan],
        ),
      ),
    ).rejects.toThrow('row-level security');
  });

  /**
   * Row (3): the worker writes this schema. Task 50.1.2's centre gave the request tier a read — of the bound
   * recipient's rows only, which `notification-centre.e2e-spec.ts` holds — so with an organization bound and no
   * recipient it reads nothing, and it writes no notice or delivery at all.
   */
  it('shows the request tier nothing without a recipient, and lets it write no notice', async () => {
    expect(await asOrganization(app, ORG, (run) => run(`SELECT id FROM notification.notification`))).toEqual([]);
    expect(await asOrganization(app, ORG, (run) => run(`SELECT id FROM notification.delivery`))).toEqual([]);
    await expect(
      asOrganization(app, ORG, (run) =>
        run(
          `INSERT INTO notification.notification
                  (id, organization_id, category_key, subject_ref, recipient_scope, deep_link)
           VALUES (gen_random_uuid(), $1, 'identity.invitation', 's', 'default', '/x')`,
          [ORG],
        ),
      ),
    ).rejects.toThrow('permission denied');
  });

  // FR-161's read and dismissed state is a centre's; an email is not read in the product's sense.
  it('refuses read state on an email delivery', async () => {
    const outboxKey = await raise({ recipientUserIds: [ana], subjectRef: `${SUITE}:read-state` });
    await dispatch(outboxKey);

    await expect(
      asOrganization(worker, ORG, (run) =>
        run(
          `INSERT INTO notification.delivery
                  (notification_id, organization_id, recipient_account_id, channel, outcome, read_at)
           VALUES ($1, $2, $3, 'email', 'accepted', now())`,
          [outboxKey, ORG, ivan],
        ),
      ),
    ).rejects.toThrow('delivery_read_state_in_app_only');
  });
});
