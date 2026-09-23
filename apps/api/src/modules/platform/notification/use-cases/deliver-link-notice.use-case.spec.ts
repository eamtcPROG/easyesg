import type { DeliverNoticeCommand } from '@api/contracts/notification-delivery.port';
import type { NotificationRecipientsPort } from '@api/contracts/notification-recipients.port';
import { noticeIdFor } from '../domain/notice-id';
import type { EmailChannel, NotificationEmail } from '../interfaces/email-channel.interface';
import type { NotificationChannelDecision } from '../interfaces/notification-channel-decision.interface';
import type {
  NotificationRecord,
  OpenNotificationCommand,
  RecordEmailAcceptedCommand,
} from '../interfaces/notification-store.interface';
import type { NotificationChannel } from '../models/notification-category.model';
import { DELIVERY_OUTCOME } from '../models/notification-record.model';
import { DeliverLinkNotice, type LinkNoticeStore } from './deliver-link-notice.use-case';

/**
 * The four address notices' flow (task 50.1.4), hermetic and framework-free like the use case:
 * `notification-address-notices.e2e-spec.ts` drives it over the real store and the real accounts. **The store is a
 * fake** that records what it was asked to open and deliver and remembers what it recorded, so a redelivered job
 * can be shown to send nothing twice. Literals on purpose: they are the stored and sent values.
 */
describe('DeliverLinkNotice (task 50.1.4)', () => {
  class FakeStore implements LinkNoticeStore {
    readonly opened: OpenNotificationCommand[] = [];
    readonly accepted: RecordEmailAcceptedCommand[] = [];
    delivered = false;

    open(command: OpenNotificationCommand): Promise<NotificationRecord> {
      this.opened.push(command);
      return Promise.resolve({
        notificationId: command.notificationId,
        state: 'delivered',
        deepLink: command.deepLink,
        params: command.params,
        delivered: this.accepted.map(() => ({ recipientId: null, channel: 'email' as const })),
      });
    }
    recordEmailAccepted(command: RecordEmailAcceptedCommand): Promise<void> {
      this.accepted.push(command);
      return Promise.resolve();
    }
    markDelivered(): Promise<void> {
      this.delivered = true;
      return Promise.resolve();
    }
  }

  const ANA = '11111111-1111-4111-8111-111111111111';
  const ORGANIZATION = '44444444-4444-4444-8444-444444444444';
  const KEY = 'identity.invitation.issued:invitation-1:1790726400000';

  const invitation: DeliverNoticeCommand = {
    issuanceKey: KEY,
    occurredAtMicros: 1_790_726_400_000_000,
    organizationId: ORGANIZATION,
    categoryKey: 'identity.invitation',
    recipient: { address: 'ivan@example.md', locale: 'ru' },
    application: 'web',
    deepLink: '/invitation',
    linkPath: '/invitation/token-1',
    params: { organizationName: 'Brutăria' },
  };

  const build = (channels: readonly NotificationChannel[] = ['email']) => {
    const sent: NotificationEmail[] = [];
    const email: EmailChannel = {
      send: (message) => {
        sent.push(message);
        return Promise.resolve({ outcome: DELIVERY_OUTCOME.ACCEPTED });
      },
    };
    const store = new FakeStore();
    const recipients: NotificationRecipientsPort = {
      resolve: ({ userIds }) =>
        Promise.resolve(userIds.includes(ANA) ? [{ userId: ANA, email: 'ana@example.md', locale: 'en' as const }] : []),
    };
    const decision: NotificationChannelDecision = { channelsFor: () => channels };
    const deliver = new DeliverLinkNotice(recipients, email, decision, store, {
      web: 'https://app.easyesg.md',
      console: 'https://admin.easyesg.md',
    });
    return { deliver, sent, store };
  };

  it('sends an address its link, in its language, keyed by the issuance, with the link as {link}', async () => {
    const { deliver, sent } = build();
    await deliver.execute(invitation);

    expect(sent).toEqual([
      {
        categoryKey: 'identity.invitation',
        to: 'ivan@example.md',
        locale: 'ru',
        params: { organizationName: 'Brutăria', link: 'https://app.easyesg.md/ru/invitation/token-1' },
        idempotencyKey: KEY,
      },
    ]);
  });

  // Rows (14), (15), (16): the issuance is the notice, the sent link goes to the store to be sealed, and the
  // delivery names the address.
  it('records the issuance as its own notice, the sent link to be sealed, and the address as the recipient', async () => {
    const { deliver, store } = build();
    await deliver.execute(invitation);

    expect(store.opened).toEqual([
      {
        notificationId: noticeIdFor(KEY),
        organizationId: ORGANIZATION,
        categoryKey: 'identity.invitation',
        subjectRef: KEY,
        recipientScope: 'default',
        raisedAtMicros: invitation.occurredAtMicros,
        deepLink: '/invitation',
        application: 'web',
        params: { organizationName: 'Brutăria' },
        sealedLink: 'https://app.easyesg.md/ru/invitation/token-1',
      },
    ]);
    expect(store.accepted.map((command) => command.recipient)).toEqual([{ address: 'ivan@example.md' }]);
    expect(store.delivered).toBe(true);
  });

  it('resolves an account at send time, and records the account rather than its address', async () => {
    const { deliver, sent, store } = build();
    await deliver.execute({ ...invitation, recipient: { accountId: ANA }, organizationId: undefined });

    expect(sent.map((message) => [message.to, message.locale])).toEqual([['ana@example.md', 'en']]);
    expect(store.accepted.map((command) => command.recipient)).toEqual([{ accountId: ANA }]);
  });

  // Row (17): no organization named is a platform notice, under the reserved id.
  it('records a notice that names no organization under the platform id', async () => {
    const { deliver, store } = build();
    await deliver.execute({ ...invitation, organizationId: undefined });

    expect(store.opened[0].organizationId).toBe('00000000-0000-0000-0000-000000000000');
  });

  // Task 165: the command's application decides the link's origin AND what the notice records — so the record is
  // asserted here too, where the value is not `web`. Every other case in this file is, so the `toEqual` above
  // would pass a use case that wrote the literal.
  it('links the console without a language in its path, and records the console', async () => {
    const { deliver, sent, store } = build();
    await deliver.execute({ ...invitation, application: 'console', linkPath: '/invitation/token-2' });

    expect(sent[0].params.link).toBe('https://admin.easyesg.md/invitation/token-2');
    expect(store.opened[0].application).toBe('console');
  });

  it("carries the category's second wording when one is named", async () => {
    const { deliver, sent } = build();
    await deliver.execute({ ...invitation, templateKey: 'identity.password_setup' });

    expect(sent[0].templateKey).toBe('identity.password_setup');
  });

  it('sends nothing twice when the same issuance runs again', async () => {
    const { deliver, sent } = build();
    await deliver.execute(invitation);
    await deliver.execute(invitation);

    expect(sent).toHaveLength(1);
  });

  it('skips an account that no longer exists, and says so', async () => {
    const { deliver, sent, store } = build();
    const result = await deliver.execute({ ...invitation, recipient: { accountId: 'gone' } });

    expect(result).toEqual({ skipped: 'account_gone' });
    expect(sent).toEqual([]);
    expect(store.opened).toEqual([]);
  });

  // Row (20): a notice carrying a token has no use in a centre, so an in-app channel is ignored and the email goes.
  it('sends the email of a category published with in-app too, and never delivers in-app', async () => {
    const { deliver, sent } = build(['in_app', 'email']);

    await expect(deliver.execute(invitation)).resolves.toEqual({ skipped: null });
    expect(sent).toHaveLength(1);
  });

  it('sends nothing, and says why, for a category published with no email', async () => {
    const { deliver, sent, store } = build(['in_app']);

    await expect(deliver.execute(invitation)).resolves.toEqual({ skipped: 'not_by_email' });
    expect(sent).toEqual([]);
    expect(store.opened).toEqual([]);
  });
});
