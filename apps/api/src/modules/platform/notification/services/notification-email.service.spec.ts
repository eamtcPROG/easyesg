import { Logger } from '@nestjs/common';
import type { EmailDispatched, EmailMessage, EmailPort } from '@api/contracts/email.port';
import { NOTIFICATION_CATEGORY } from '@api/contracts/notification.port';
import type { NotificationCategoryBehaviour } from '../models/notification-category.model';
import { CategoryChannels } from './category-channels.service';
import { EmailChannelService } from './email-channel.service';
import type { NotificationCategoryCatalog } from './notification-category-catalog.service';
import { NotificationEmailService } from './notification-email.service';

/**
 * A category's email for the outbox handlers (task 49.2; category-driven since 49.3), through the module's one
 * email channel: the category decides whether it goes by email, and what reaches the provider is exact.
 */
describe('NotificationEmailService (tasks 49.2, 49.3)', () => {
  class RecordingEmailPort implements EmailPort {
    readonly sent: EmailMessage[] = [];

    send(message: EmailMessage): Promise<EmailDispatched> {
      this.sent.push(message);
      return Promise.resolve({ providerMessageId: 'provider-1' });
    }
  }

  const catalogOf = (behaviour: NotificationCategoryBehaviour | null) =>
    ({ behaviourOf: () => behaviour }) as unknown as NotificationCategoryCatalog;
  const build = (behaviour: NotificationCategoryBehaviour | null, provider: EmailPort = new RecordingEmailPort()) =>
    new NotificationEmailService(new EmailChannelService(provider), new CategoryChannels(catalogOf(behaviour)));

  const byEmail: NotificationCategoryBehaviour = { channels: ['email'], classification: 'transactional' };
  const base = {
    to: 'ana@example.md',
    locale: 'ro',
    params: { verificationUrl: 'https://app.easyesg.md/ro/verify?token=t' },
    idempotencyKey: 'outbox-1',
  } as const;

  let warned: string[] = [];
  beforeEach(() => {
    warned = [];
    jest.spyOn(Logger.prototype, 'warn').mockImplementation((message: unknown) => {
      warned.push(String(message));
    });
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it("sends the category's own wording when no second one is named", async () => {
    const provider = new RecordingEmailPort();
    await build(byEmail, provider).send({ ...base, categoryKey: NOTIFICATION_CATEGORY.EMAIL_VERIFICATION });

    expect(provider.sent).toEqual([{ ...base, templateKey: 'identity.email_verification' }]);
  });

  it('sends the second wording a category names, and not its key', async () => {
    const provider = new RecordingEmailPort();
    await build(byEmail, provider).send({
      ...base,
      categoryKey: NOTIFICATION_CATEGORY.PASSWORD_RESET,
      templateKey: 'identity.password_setup',
    });

    expect(provider.sent[0].templateKey).toBe('identity.password_setup');
  });

  // A broken artefact is not a reason for a mandatory notice — a verification link — to go unsent (task 49.3).
  it('still sends a mandatory category whose behaviour cannot be read, by email', async () => {
    const provider = new RecordingEmailPort();
    await build(null, provider).send({ ...base, categoryKey: NOTIFICATION_CATEGORY.INVITATION });

    expect(provider.sent).toHaveLength(1);
    expect(warned.join('\n')).toContain('floor');
  });

  // The same refusal as a raised notice's (§12.5.6's task-49.3 row (5)) — this path used to drop the in-app half.
  it.each([[['in_app']], [['in_app', 'email']]] as const)(
    'fails a category travelling in-app (%j) before sending anything',
    async (channels) => {
      const provider = new RecordingEmailPort();

      await expect(
        build({ channels, classification: 'transactional' }, provider).send({
          ...base,
          categoryKey: NOTIFICATION_CATEGORY.INVITATION,
        }),
      ).rejects.toThrow('task 50.1');
      expect(provider.sent).toEqual([]);
    },
  );

  // Unreachable while in-app is refused, and live the day 50.1 lifts that: an in-app-only category sends no email.
  it('sends nothing for a category whose channels exclude email, and says so', async () => {
    const provider = new RecordingEmailPort();
    const service = new NotificationEmailService(new EmailChannelService(provider), {
      channelsFor: () => ['in_app'],
    } as unknown as CategoryChannels);

    await service.send({ ...base, categoryKey: NOTIFICATION_CATEGORY.INVITATION });

    expect(provider.sent).toEqual([]);
    expect(warned.join('\n')).toContain('does not travel by email');
  });

  it('lets a provider failure reach the job, so the queue records it', async () => {
    const failing: EmailPort = { send: () => Promise.reject(new Error('provider down')) };

    await expect(
      build(byEmail, failing).send({ ...base, categoryKey: NOTIFICATION_CATEGORY.INVITATION }),
    ).rejects.toThrow('provider down');
  });
});
