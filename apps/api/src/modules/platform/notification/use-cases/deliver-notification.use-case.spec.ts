import type { NotificationEmail } from '@api/contracts/notification-email.port';
import type {
  NotificationRecipient,
  NotificationRecipientsPort,
} from '@api/contracts/notification-recipients.port';
import type { NotificationRaised } from '../constants/notification.constants';
import type { EmailChannel } from '../interfaces/email-channel.interface';
import type {
  DeliverInAppCommand,
  NoticeRef,
  NotificationRecord,
  NotificationStore,
  OpenNotificationCommand,
  RecordEmailAcceptedCommand,
  RecordedDelivery,
} from '../interfaces/notification-store.interface';
import type { NotificationChannel } from '../models/notification-category.model';
import type { NotificationState } from '../models/notification-record.model';
import { DeliverNotification, type NotificationChannelDecision } from './deliver-notification.use-case';

/**
 * UC-172 … UC-174's flow over a raised notice (tasks 49.3, 50.1.1), hermetic and framework-free like the use case:
 * `notification-dispatch.e2e-spec.ts` drives it over a real outbox row, real accounts and the real store. **The
 * channel decision is a stub** — its rules are `CategoryChannels`' spec — and **the store is a fake that models the
 * record's rules**: one open notice per key, one delivery per recipient and channel, a redelivered job finding its
 * own notice. So this pins what the use case does with what is recorded — deliver what is owed, in order, and only
 * that.
 */
describe('DeliverNotification (tasks 49.3, 50.1.1)', () => {
  class RecordingEmailChannel implements EmailChannel {
    readonly sent: NotificationEmail[] = [];
    failWith: Error | null = null;

    send(email: NotificationEmail): Promise<void> {
      if (this.failWith) return Promise.reject(this.failWith);
      this.sent.push(email);
      events.push(`email:${email.to}`);
      return Promise.resolve();
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

    open(command: OpenNotificationCommand): Promise<NotificationRecord> {
      const sameKey = (notice: Notice) =>
        notice.state !== 'cancelled' &&
        notice.command.organizationId === command.organizationId &&
        notice.command.categoryKey === command.categoryKey &&
        notice.command.subjectRef === command.subjectRef &&
        notice.command.recipientScope === command.recipientScope;
      let notice =
        this.notices.find((each) => each.command.notificationId === command.notificationId) ??
        this.notices.find(sameKey);
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

    recordEmailAccepted(command: RecordEmailAcceptedCommand): Promise<void> {
      this.record(command, command.recipientId, 'email');
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

  const build = (decision: NotificationChannelDecision = answering(['email'])) => {
    const email = new RecordingEmailChannel();
    const store = new FakeNotificationStore();
    const recipients: NotificationRecipientsPort = {
      resolve: ({ userIds }) => Promise.resolve(people.filter((person) => userIds.includes(person.userId))),
    };
    const deliver = new DeliverNotification(recipients, email, decision, store, 'https://app.easyesg.md');
    const run = (raised: NotificationRaised, deliveryId: string) =>
      deliver.execute({ notice: raised, organizationId: ORGANIZATION, deliveryId });
    return { run, email, store };
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

    expect(events).toEqual([`in_app:${ANA},${IVAN}`, 'email:ana@example.md', 'email:ivan@example.md']);
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
});
