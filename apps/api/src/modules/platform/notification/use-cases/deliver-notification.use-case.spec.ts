import type { NotificationEmail } from '@api/contracts/notification-email.port';
import type {
  NotificationRecipient,
  NotificationRecipientsPort,
} from '@api/contracts/notification-recipients.port';
import type { EmailChannel } from '../interfaces/email-channel.interface';
import type { NotificationChannel } from '../models/notification-category.model';
import { DeliverNotification, type NotificationChannelDecision } from './deliver-notification.use-case';

/**
 * UC-173's flow over a raised notice (task 49.3), hermetic and framework-free like the use case:
 * `notification-dispatch.e2e-spec.ts` drives it over a real outbox row and real accounts. **The channel decision is
 * a stub here** — its rules (the mandatory floor, the in-app refusal) are `CategoryChannels`' spec — so this pins
 * what the use case does with each answer: deliver, refuse before sending, or send nothing.
 */
describe('DeliverNotification (task 49.3)', () => {
  class RecordingEmailChannel implements EmailChannel {
    readonly sent: NotificationEmail[] = [];

    send(email: NotificationEmail): Promise<void> {
      this.sent.push(email);
      return Promise.resolve();
    }
  }

  const ANA = '11111111-1111-4111-8111-111111111111';
  const IVAN = '22222222-2222-4222-8222-222222222222';
  const NOBODY = '33333333-3333-4333-8333-333333333333';
  const people: NotificationRecipient[] = [
    { userId: ANA, email: 'ana@example.md', locale: 'ro' },
    { userId: IVAN, email: 'ivan@example.md', locale: 'ru' },
  ];

  const answering = (channels: readonly NotificationChannel[]): NotificationChannelDecision => ({
    channelsFor: () => channels,
  });
  const notice = {
    categoryKey: 'identity.invitation',
    recipientUserIds: [ANA, IVAN],
    subjectRef: 'invitation:1',
    deepLink: '/invitation/abc',
    params: { organizationName: 'Brutăria' },
  } as const;

  const build = (decision: NotificationChannelDecision = answering(['email'])) => {
    const email = new RecordingEmailChannel();
    const recipients: NotificationRecipientsPort = {
      resolve: ({ userIds }) => Promise.resolve(people.filter((person) => userIds.includes(person.userId))),
    };
    const deliver = new DeliverNotification(recipients, email, decision, 'https://app.easyesg.md');
    return { deliver, email };
  };

  it("sends each recipient the category's email, in their own language, with their own link and key", async () => {
    const { deliver, email } = build();
    const result = await deliver.execute({
      notice: { ...notice, recipientUserIds: [...notice.recipientUserIds] },
      deliveryId: 'outbox-key-1',
    });

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

  it('skips an id that names no account, still sends the others, and answers which it skipped', async () => {
    const { deliver, email } = build();
    const result = await deliver.execute({
      notice: { ...notice, recipientUserIds: [ANA, NOBODY] },
      deliveryId: 'outbox-key-1',
    });

    expect(email.sent.map((sent) => sent.to)).toEqual(['ana@example.md']);
    expect(result.unresolved).toEqual([NOBODY]);
  });

  // A refused decision — in-app until 50.1, an unreadable optional category — fails the job before anything goes.
  it('sends nothing when the channel decision refuses, and lets the refusal fail the job', async () => {
    const { deliver, email } = build({
      channelsFor: () => {
        throw new Error('refused');
      },
    });

    await expect(
      deliver.execute({ notice: { ...notice, recipientUserIds: [ANA] }, deliveryId: 'k' }),
    ).rejects.toThrow('refused');
    expect(email.sent).toEqual([]);
  });

  // Unreachable while in-app is refused, and live the day 50.1 lifts that: an in-app-only notice sends no email.
  it('sends no email when the channels exclude it, and resolves no one', async () => {
    const email = new RecordingEmailChannel();
    const resolve = jest.fn();
    const deliver = new DeliverNotification({ resolve }, email, answering(['in_app']), 'https://app.easyesg.md');

    await expect(
      deliver.execute({ notice: { ...notice, recipientUserIds: [ANA] }, deliveryId: 'k' }),
    ).resolves.toEqual({ unresolved: [] });
    expect(email.sent).toEqual([]);
    expect(resolve).not.toHaveBeenCalled();
  });

});
