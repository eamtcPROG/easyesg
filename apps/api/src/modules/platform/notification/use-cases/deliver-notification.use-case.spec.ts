import type {
  NotificationRecipient,
  NotificationRecipientsPort,
} from '@api/contracts/notification-recipients.port';
import type { NotificationRaised } from '../constants/notification.constants';
import type { DispatchLatency, RaisedDispatch } from '../interfaces/dispatch-latency.interface';
import type { EmailChannel, EmailChannelResult, NotificationEmail } from '../interfaces/email-channel.interface';
import type {
  DeliverInAppCommand,
  NoticeRef,
  NotificationRecord,
  NotificationStore,
  OpenNotificationCommand,
  RecordEmailAcceptedCommand,
  RecordOptedOutCommand,
  RecordedDelivery,
} from '../interfaces/notification-store.interface';
import type { NotificationCategoryBehaviours } from '../interfaces/notification-category-behaviours.interface';
import type { NotificationOptOuts, OptedOutRecipient } from '../interfaces/notification-opt-outs.interface';
import { NOTIFICATION_CLASSIFICATION, type NotificationChannel } from '../models/notification-category.model';
import { DELIVERY_OUTCOME, type DeliveryOutcome, type NotificationState } from '../models/notification-record.model';
import type { NotificationChannelDecision } from '../interfaces/notification-channel-decision.interface';
import { plainTokens } from '../testing/notification-preference-store.fake';
import { DeliverNotification } from './deliver-notification.use-case';

/**
 * UC-172 … UC-174's flow over a raised notice (tasks 49.3, 50.1.1), hermetic and framework-free like the use case:
 * `notification-dispatch.e2e-spec.ts` drives it over a real outbox row, real accounts and the real store. **The
 * channel decision is a stub** — its rules are `CategoryChannels`' spec — and **the store is a fake that models the
 * record's rules**: one open notice per key, one delivery per recipient and channel, a redelivered job finding its
 * own notice. So this pins what the use case does with what is recorded — deliver what is owed, in order, and only
 * that.
 */
describe('DeliverNotification (tasks 49.3, 50.1.1, 50.1.3)', () => {
  class RecordingEmailChannel implements EmailChannel {
    readonly sent: NotificationEmail[] = [];
    failWith: Error | null = null;
    /** What the channel answers for an address other than `accepted` — a bounce or a suppression (task 51.4). */
    readonly outcomes = new Map<string, DeliveryOutcome>();

    send(email: NotificationEmail): Promise<EmailChannelResult> {
      if (this.failWith) return Promise.reject(this.failWith);
      this.sent.push(email);
      events.push(`email:${email.to}`);
      return Promise.resolve({ outcome: this.outcomes.get(email.to) ?? DELIVERY_OUTCOME.ACCEPTED });
    }
  }

  /** NFR-106's measurement as the flow reports it (task 202), in the order reported. */
  class RecordingLatency implements DispatchLatency {
    readonly dispatches: RaisedDispatch[] = [];

    dispatched(dispatch: RaisedDispatch): void {
      this.dispatches.push(dispatch);
    }
  }

  interface Notice {
    command: OpenNotificationCommand;
    state: NotificationState;
    deliveries: RecordedDelivery[];
  }

  /** The record's rules, as the migration's constraints state them. Literals on purpose: they are stored values. */
  class FakeNotificationStore implements NotificationStore {
    readonly notices: Notice[] = [];
    /** Every `opted_out` row, in the order written (task 52.2.1). */
    readonly optedOut: { recipientId: string; channel: NotificationChannel }[] = [];
    /** Each key's latest cancellation, as `notification.cancellation` holds it. */
    readonly cancellations = new Map<string, number>();

    static key(command: { categoryKey: string; subjectRef: string; recipientScope: string }): string {
      return `${command.categoryKey}|${command.subjectRef}|${command.recipientScope}`;
    }

    open(command: OpenNotificationCommand): Promise<NotificationRecord> {
      const sameKey = (notice: Notice) =>
        notice.state !== 'cancelled' &&
        notice.command.organizationId === command.organizationId &&
        notice.command.categoryKey === command.categoryKey &&
        notice.command.subjectRef === command.subjectRef &&
        notice.command.recipientScope === command.recipientScope;
      const own = this.notices.find((each) => each.command.notificationId === command.notificationId);
      const cancelledAt = this.cancellations.get(FakeNotificationStore.key(command));
      if (!own && cancelledAt !== undefined && cancelledAt >= command.raisedAtMicros) {
        return Promise.resolve({
          notificationId: command.notificationId,
          state: 'cancelled',
          deepLink: command.deepLink,
          params: command.params,
          delivered: [],
        });
      }
      let notice = own ?? this.notices.find(sameKey);
      if (!notice) {
        notice = { command, state: 'raised', deliveries: [] };
        this.notices.push(notice);
      }
      return Promise.resolve({
        notificationId: notice.command.notificationId,
        state: notice.state,
        deepLink: notice.command.deepLink,
        params: notice.command.params,
        delivered: [...notice.deliveries],
      });
    }

    deliverInApp(command: DeliverInAppCommand): Promise<void> {
      for (const recipientId of command.recipientIds) this.record(command, recipientId, 'in_app');
      events.push(`in_app:${command.recipientIds.join(',')}`);
      return Promise.resolve();
    }

    recordOptedOut(command: RecordOptedOutCommand): Promise<void> {
      for (const recipientId of command.recipientIds) {
        this.record(command, recipientId, command.channel);
        this.optedOut.push({ recipientId, channel: command.channel });
      }
      events.push(`opted_out:${command.channel}:${command.recipientIds.join(',')}`);
      return Promise.resolve();
    }

    /** The next email row's write fails once — a crash between the provider's answer and the record (task 202). */
    failNextEmailRecord: Error | null = null;

    recordEmailAccepted(command: RecordEmailAcceptedCommand): Promise<void> {
      if (this.failNextEmailRecord) {
        const failure = this.failNextEmailRecord;
        this.failNextEmailRecord = null;
        return Promise.reject(failure);
      }
      if (!('accountId' in command.recipient)) throw new Error('a raised notice reaches accounts only');
      this.record(command, command.recipient.accountId, 'email');
      return Promise.resolve();
    }

    markDelivered(command: NoticeRef): Promise<void> {
      const notice = this.find(command);
      if (notice.state === 'raised') notice.state = 'delivered';
      return Promise.resolve();
    }

    private record(ref: NoticeRef, recipientId: string, channel: NotificationChannel): void {
      const notice = this.find(ref);
      const exists = notice.deliveries.some((d) => d.recipientId === recipientId && d.channel === channel);
      if (!exists) notice.deliveries.push({ recipientId, channel });
    }

    private find(ref: NoticeRef): Notice {
      const notice = this.notices.find((each) => each.command.notificationId === ref.notificationId);
      if (!notice) throw new Error(`no notice ${ref.notificationId}`);
      return notice;
    }
  }

  const ORGANIZATION = '44444444-4444-4444-8444-444444444444';
  const ANA = '11111111-1111-4111-8111-111111111111';
  const IVAN = '22222222-2222-4222-8222-222222222222';
  const NOBODY = '33333333-3333-4333-8333-333333333333';
  /** The outbox row's time a run carries unless a case names its own. */
  const RAISED_AT = 1_790_726_400_000_000;
  const people: NotificationRecipient[] = [
    { userId: ANA, email: 'ana@example.md', locale: 'ro' },
    { userId: IVAN, email: 'ivan@example.md', locale: 'ru' },
  ];

  let events: string[] = [];
  beforeEach(() => {
    events = [];
  });

  const answering = (channels: readonly NotificationChannel[]): NotificationChannelDecision => ({
    channelsFor: () => channels,
  });
  const notice = (overrides: Partial<NotificationRaised> = {}): NotificationRaised => ({
    categoryKey: 'identity.invitation',
    recipientUserIds: [ANA, IVAN],
    subjectRef: 'invitation:1',
    recipientScope: 'default',
    deepLink: '/invitation/abc',
    params: { organizationName: 'Brutăria' },
    ...overrides,
  });

  /** Who switched what off — the preference table as the worker reads it — and how often it was asked. */
  class FakeOptOuts implements NotificationOptOuts {
    asked = 0;
    constructor(public rows: OptedOutRecipient[] = []) {}

    optedOut(query: { readonly accountIds: readonly string[] }): Promise<readonly OptedOutRecipient[]> {
      this.asked += 1;
      return Promise.resolve(this.rows.filter((row) => query.accountIds.includes(row.accountId)));
    }
  }

  /** A category's classification in force; the channels are `answering`'s, which is the decision this reads. */
  const classified = (
    classification: (typeof NOTIFICATION_CLASSIFICATION)[keyof typeof NOTIFICATION_CLASSIFICATION],
  ): NotificationCategoryBehaviours => ({
    behaviourOf: () => ({ channels: ['in_app', 'email'], classification }),
  });

  const build = (
    decision: NotificationChannelDecision = answering(['email']),
    options: { categories?: NotificationCategoryBehaviours; optOuts?: FakeOptOuts } = {},
  ) => {
    const email = new RecordingEmailChannel();
    const store = new FakeNotificationStore();
    const optOuts = options.optOuts ?? new FakeOptOuts();
    const latency = new RecordingLatency();
    const recipients: NotificationRecipientsPort = {
      resolve: ({ userIds }) => Promise.resolve(people.filter((person) => userIds.includes(person.userId))),
    };
    const deliver = new DeliverNotification(
      recipients,
      email,
      decision,
      store,
      'https://app.easyesg.md',
      options.categories ?? classified(NOTIFICATION_CLASSIFICATION.TRANSACTIONAL),
      optOuts,
      plainTokens,
      // AD-15's hint (task 148), recorded in the same sequence as the store's writes, so its order is assertable.
      {
        publish: (hint) => {
          events.push(`hint:${hint.event}:${'accountIds' in hint ? hint.accountIds.join(',') : ''}`);
          return Promise.resolve();
        },
      },
      latency,
    );
    const run = (raised: NotificationRaised, deliveryId: string, raisedAtMicros = RAISED_AT) =>
      deliver.execute({ notice: raised, organizationId: ORGANIZATION, deliveryId, raisedAtMicros });
    return { run, email, store, optOuts, latency };
  };

  it("sends each recipient the category's email, in their own language, with their own link and key", async () => {
    const { run, email } = build();
    const result = await run(notice(), 'outbox-key-1');

    expect(email.sent).toEqual([
      {
        categoryKey: 'identity.invitation',
        to: 'ana@example.md',
        locale: 'ro',
        params: { organizationName: 'Brutăria', link: 'https://app.easyesg.md/ro/invitation/abc' },
        idempotencyKey: `outbox-key-1:${ANA}`,
      },
      {
        categoryKey: 'identity.invitation',
        to: 'ivan@example.md',
        locale: 'ru',
        params: { organizationName: 'Brutăria', link: 'https://app.easyesg.md/ru/invitation/abc' },
        idempotencyKey: `outbox-key-1:${IVAN}`,
      },
    ]);
    expect(result.unresolved).toEqual([]);
  });

  it("records the notice under the raise's id, an email delivery per recipient, and marks it delivered", async () => {
    const { run, store } = build();
    await run(notice(), 'outbox-key-1');

    expect(store.notices).toHaveLength(1);
    expect(store.notices[0]).toMatchObject({ command: { notificationId: 'outbox-key-1' }, state: 'delivered' });
    expect(store.notices[0].deliveries).toEqual([
      { recipientId: ANA, channel: 'email' },
      { recipientId: IVAN, channel: 'email' },
    ]);
  });

  it('skips an id that names no account, still sends the others, and answers which it skipped', async () => {
    const { run, email } = build();
    const result = await run(notice({ recipientUserIds: [ANA, NOBODY] }), 'outbox-key-1');

    expect(email.sent.map((sent) => sent.to)).toEqual(['ana@example.md']);
    expect(result.unresolved).toEqual([NOBODY]);
  });

  // A refused decision — an unreadable optional category — fails the job before anything is recorded or sent.
  it('records and sends nothing when the channel decision refuses, and lets the refusal fail the job', async () => {
    const { run, email, store } = build({
      channelsFor: () => {
        throw new Error('refused');
      },
    });

    await expect(run(notice(), 'k')).rejects.toThrow('refused');
    expect(email.sent).toEqual([]);
    expect(store.notices).toEqual([]);
  });

  it('delivers an in-app-only notice to each centre and sends no email', async () => {
    const { run, email, store } = build(answering(['in_app']));
    await run(notice(), 'outbox-key-1');

    expect(email.sent).toEqual([]);
    expect(store.notices[0].deliveries).toEqual([
      { recipientId: ANA, channel: 'in_app' },
      { recipientId: IVAN, channel: 'in_app' },
    ]);
    expect(store.notices[0].state).toBe('delivered');
  });

  // FR-168: the centre fills with no provider in the path, so an outage cannot hold the in-app half back.
  it('writes in-app before any email is sent', async () => {
    const { run } = build(answering(['in_app', 'email']));
    await run(notice(), 'outbox-key-1');

    expect(events).toEqual([
      `in_app:${ANA},${IVAN}`,
      `hint:notification.unread_changed:${ANA},${IVAN}`,
      'email:ana@example.md',
      'email:ivan@example.md',
    ]);
  });

  // Task 148: the hint follows the in-app write — a refetch it triggers finds the delivery — and an email-only notice,
  // which moves no centre's count, hints nobody.
  it('hints the in-app recipients once their deliveries are written, and nobody for an email-only notice', async () => {
    await build(answering(['in_app'])).run(notice(), 'outbox-key-1');
    expect(events).toEqual([`in_app:${ANA},${IVAN}`, `hint:notification.unread_changed:${ANA},${IVAN}`]);

    events = [];
    await build(answering(['email'])).run(notice(), 'outbox-key-2');
    expect(events.filter((event) => event.startsWith('hint:'))).toEqual([]);
  });

  it('keeps in-app delivered through a provider failure, and completes only the email when run again', async () => {
    const { run, email, store } = build(answering(['in_app', 'email']));
    email.failWith = new Error('provider down');

    await expect(run(notice(), 'outbox-key-1')).rejects.toThrow('provider down');
    expect(store.notices[0].state).toBe('raised');
    expect(store.notices[0].deliveries.map((d) => d.channel)).toEqual(['in_app', 'in_app']);

    email.failWith = null;
    events = [];
    await run(notice(), 'outbox-key-1');

    expect(events).toEqual(['email:ana@example.md', 'email:ivan@example.md']);
    expect(store.notices[0].state).toBe('delivered');
  });

  it('delivers nothing twice when the same job runs again', async () => {
    const { run, email, store } = build(answering(['in_app', 'email']));
    await run(notice(), 'outbox-key-1');
    events = [];

    await run(notice(), 'outbox-key-1');

    expect(events).toEqual([]);
    expect(email.sent).toHaveLength(2);
    expect(store.notices).toHaveLength(1);
  });

  // FR-167 and row (6): a raise meeting an open notice for its key adds recipients, and only they are reached.
  it('folds a second raise into the open notice and reaches only the recipient it adds, with that notice', async () => {
    const { run, email, store } = build();
    await run(notice({ recipientUserIds: [ANA] }), 'outbox-key-1');

    await run(
      notice({ recipientUserIds: [ANA, IVAN], deepLink: '/elsewhere', params: { organizationName: 'Alta' } }),
      'outbox-key-2',
    );

    expect(store.notices).toHaveLength(1);
    expect(email.sent.map((sent) => sent.to)).toEqual(['ana@example.md', 'ivan@example.md']);
    expect(email.sent[1]).toMatchObject({
      params: { organizationName: 'Brutăria', link: 'https://app.easyesg.md/ru/invitation/abc' },
      idempotencyKey: `outbox-key-1:${IVAN}`,
    });
  });

  it('keeps two audiences of one subject as two notices', async () => {
    const { run, email, store } = build();
    await run(notice({ recipientUserIds: [ANA] }), 'outbox-key-1');
    await run(notice({ recipientUserIds: [ANA], recipientScope: 'administrators' }), 'outbox-key-2');

    expect(store.notices).toHaveLength(2);
    expect(email.sent.map((sent) => sent.idempotencyKey)).toEqual([`outbox-key-1:${ANA}`, `outbox-key-2:${ANA}`]);
  });

  it('delivers nothing more for a cancelled notice', async () => {
    const { run, email, store } = build();
    await run(notice({ recipientUserIds: [ANA] }), 'outbox-key-1');
    store.notices[0].state = 'cancelled';

    await run(notice({ recipientUserIds: [ANA, IVAN] }), 'outbox-key-1');

    expect(email.sent.map((sent) => sent.to)).toEqual(['ana@example.md']);
    expect(store.notices[0].state).toBe('cancelled');
  });

  // Row (12): a cancellation the workers applied first still stands against the raise it came after.
  it('delivers nothing for a raise its key was cancelled after, and delivers a later one', async () => {
    const { run, email, store } = build();
    store.cancellations.set(
      FakeNotificationStore.key({ categoryKey: 'identity.invitation', subjectRef: 'invitation:1', recipientScope: 'default' }),
      1_790_726_400_000_000,
    );

    await run(notice({ recipientUserIds: [ANA] }), 'outbox-key-1', 1_790_726_399_999_999);
    expect(email.sent).toEqual([]);
    expect(store.notices).toEqual([]);

    await run(notice({ recipientUserIds: [ANA] }), 'outbox-key-2', 1_790_726_400_000_001);
    expect(email.sent.map((sent) => sent.idempotencyKey)).toEqual([`outbox-key-2:${ANA}`]);
  });
  describe('a preference honoured at dispatch (task 52.2.1)', () => {
    const REMINDER = 'reporting.manual_reminder';

    it('sends nothing on the channel a recipient switched off, records it opted out, and reaches everyone else', async () => {
      const optOuts = new FakeOptOuts([{ accountId: IVAN, channel: 'email' }]);
      const { run, email, store } = build(answering(['in_app', 'email']), {
        categories: classified(NOTIFICATION_CLASSIFICATION.OPTIONAL),
        optOuts,
      });
      await run(notice({ categoryKey: REMINDER }), 'outbox-key-1');

      expect(email.sent.map((sent) => sent.to)).toEqual(['ana@example.md']);
      expect(store.optedOut).toEqual([{ recipientId: IVAN, channel: 'email' }]);
      expect(events).toEqual([
        `opted_out:email:${IVAN}`,
        `in_app:${ANA},${IVAN}`,
        `hint:notification.unread_changed:${ANA},${IVAN}`,
        'email:ana@example.md',
      ]);
    });

    it('keeps an in-app notice out of the centre of a recipient who switched it off there', async () => {
      const { run, store } = build(answering(['in_app']), {
        categories: classified(NOTIFICATION_CLASSIFICATION.OPTIONAL),
        optOuts: new FakeOptOuts([{ accountId: ANA, channel: 'in_app' }]),
      });
      await run(notice({ categoryKey: REMINDER }), 'outbox-key-1');

      // Only the recipient whose centre gained the notice is hinted (task 148): Ana's count did not move.
      expect(events).toEqual([`opted_out:in_app:${ANA}`, `in_app:${IVAN}`, `hint:notification.unread_changed:${IVAN}`]);
      expect(store.notices[0].state).toBe('delivered');
    });

    it('never asks for a category that may not be switched off, and sends to everyone', async () => {
      const optOuts = new FakeOptOuts([{ accountId: IVAN, channel: 'email' }]);
      const { run, email, store } = build(answering(['email']), {
        categories: classified(NOTIFICATION_CLASSIFICATION.TRANSACTIONAL),
        optOuts,
      });
      await run(notice({ categoryKey: REMINDER }), 'outbox-key-1');

      expect(optOuts.asked).toBe(0);
      expect(email.sent.map((sent) => sent.to)).toEqual(['ana@example.md', 'ivan@example.md']);
      expect(store.optedOut).toEqual([]);
    });

    it('carries a signed unsubscribe, in each recipient’s language, on a category they may switch off (task 52.2.2)', async () => {
      const { run, email } = build(answering(['email']), {
        categories: classified(NOTIFICATION_CLASSIFICATION.OPTIONAL),
      });
      await run(notice({ categoryKey: REMINDER }), 'outbox-key-1');

      expect(email.sent.map((sent) => sent.unsubscribe)).toEqual([
        {
          link: `https://app.easyesg.md/ro/unsubscribe/signed:${ANA}:${REMINDER}:email`,
          oneClickUrl: `https://app.easyesg.md/mail/unsubscribe/signed:${ANA}:${REMINDER}:email`,
        },
        {
          link: `https://app.easyesg.md/ru/unsubscribe/signed:${IVAN}:${REMINDER}:email`,
          oneClickUrl: `https://app.easyesg.md/mail/unsubscribe/signed:${IVAN}:${REMINDER}:email`,
        },
      ]);
    });

    it('carries no unsubscribe on a category nobody may switch off', async () => {
      const { run, email } = build(answering(['email']));
      await run(notice(), 'outbox-key-1');

      expect(email.sent.map((sent) => sent.unsubscribe)).toEqual([undefined, undefined]);
    });

    it('does not decide twice: a job run again sends nothing to whom it recorded opted out', async () => {
      const optOuts = new FakeOptOuts([{ accountId: IVAN, channel: 'email' }]);
      const { run, email, store } = build(answering(['email']), {
        categories: classified(NOTIFICATION_CLASSIFICATION.OPTIONAL),
        optOuts,
      });
      await run(notice({ categoryKey: REMINDER }), 'outbox-key-1');
      // The person switches it back on after the send; the notice as recorded is what a redelivery honours.
      optOuts.rows = [];
      events = [];

      await run(notice({ categoryKey: REMINDER }), 'outbox-key-1');

      expect(events).toEqual([]);
      expect(email.sent.map((sent) => sent.to)).toEqual(['ana@example.md']);
      expect(store.optedOut).toEqual([{ recipientId: IVAN, channel: 'email' }]);
    });
  });

  /**
   * NFR-106's measurement (task 202; §12.5.6's task-202 row (4)): what the flow reports, from which raise, and when.
   * The interval itself is the adapter's — `otel-dispatch-latency.spec.ts` — since it reads the clock.
   */
  describe("NFR-106's raise-to-dispatch measurement (task 202)", () => {
    it('reports the in-app write as one dispatch per recipient and each email as its own, all from this raise', async () => {
      const { run, latency } = build(answering(['in_app', 'email']));
      await run(notice(), 'outbox-key-1');

      expect(latency.dispatches).toEqual([
        { channel: 'in_app', raisedAtMicros: RAISED_AT, deliveries: 2 },
        { channel: 'email', raisedAtMicros: RAISED_AT, deliveries: 1 },
        { channel: 'email', raisedAtMicros: RAISED_AT, deliveries: 1 },
      ]);
    });

    it('counts an email the provider bounced, and not one to a suppressed address, which was never sent', async () => {
      const { run, email, latency } = build(answering(['email']));
      email.outcomes.set('ana@example.md', DELIVERY_OUTCOME.BOUNCED);
      email.outcomes.set('ivan@example.md', DELIVERY_OUTCOME.SUPPRESSED);
      await run(notice(), 'outbox-key-1');

      expect(latency.dispatches).toEqual([{ channel: 'email', raisedAtMicros: RAISED_AT, deliveries: 1 }]);
    });

    it('reports nothing on the channel a recipient switched off', async () => {
      const { run, latency } = build(answering(['in_app', 'email']), {
        categories: classified(NOTIFICATION_CLASSIFICATION.OPTIONAL),
        optOuts: new FakeOptOuts([{ accountId: IVAN, channel: 'email' }]),
      });
      await run(notice({ categoryKey: 'reporting.manual_reminder' }), 'outbox-key-1');

      expect(latency.dispatches).toEqual([
        { channel: 'in_app', raisedAtMicros: RAISED_AT, deliveries: 2 },
        { channel: 'email', raisedAtMicros: RAISED_AT, deliveries: 1 },
      ]);
    });

    it('reports a dispatch only once its row is written, and once across a failed run and the run that records it', async () => {
      const { run, store, latency } = build(answering(['in_app', 'email']));
      store.failNextEmailRecord = new Error('worker lost between the send and the record');

      await expect(run(notice(), 'outbox-key-1')).rejects.toThrow('worker lost');
      expect(latency.dispatches).toEqual([{ channel: 'in_app', raisedAtMicros: RAISED_AT, deliveries: 2 }]);

      await run(notice(), 'outbox-key-1');
      await run(notice(), 'outbox-key-1');

      expect(latency.dispatches).toEqual([
        { channel: 'in_app', raisedAtMicros: RAISED_AT, deliveries: 2 },
        { channel: 'email', raisedAtMicros: RAISED_AT, deliveries: 1 },
        { channel: 'email', raisedAtMicros: RAISED_AT, deliveries: 1 },
      ]);
    });

    it("times a raise folded into an open notice from its own raise, not the notice's first", async () => {
      const { run, latency } = build();
      await run(notice({ recipientUserIds: [ANA] }), 'outbox-key-1', RAISED_AT);
      await run(notice({ recipientUserIds: [ANA, IVAN] }), 'outbox-key-2', RAISED_AT + 30_000_000);

      expect(latency.dispatches).toEqual([
        { channel: 'email', raisedAtMicros: RAISED_AT, deliveries: 1 },
        { channel: 'email', raisedAtMicros: RAISED_AT + 30_000_000, deliveries: 1 },
      ]);
    });
  });
});
