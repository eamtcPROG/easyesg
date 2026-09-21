import type { EmailDispatched, EmailMessage, EmailPort } from '@api/contracts/email.port';
import { NOTIFICATION_CATEGORY } from '@api/contracts/notification.port';
import { EmailChannelService } from './email-channel.service';

/** The one caller of `EmailPort` (tasks 49.2, 49.3): the category's own wording unless a second is named. */
describe('EmailChannelService (task 49.3)', () => {
  class RecordingEmailPort implements EmailPort {
    readonly sent: EmailMessage[] = [];

    send(message: EmailMessage): Promise<EmailDispatched> {
      this.sent.push(message);
      return Promise.resolve({ providerMessageId: 'provider-1' });
    }
  }

  const base = { to: 'ana@example.md', locale: 'ro', params: { link: 'x' }, idempotencyKey: 'k' } as const;

  it("hands the provider the category's key as the wording, and everything else unchanged", async () => {
    const provider = new RecordingEmailPort();
    await new EmailChannelService(provider).send({ ...base, categoryKey: NOTIFICATION_CATEGORY.INVITATION });

    expect(provider.sent).toEqual([{ ...base, templateKey: 'identity.invitation' }]);
  });

  it('hands it the second wording a category names instead', async () => {
    const provider = new RecordingEmailPort();
    await new EmailChannelService(provider).send({
      ...base,
      categoryKey: NOTIFICATION_CATEGORY.PASSWORD_RESET,
      templateKey: 'identity.password_setup',
    });

    expect(provider.sent[0].templateKey).toBe('identity.password_setup');
  });

  it('keeps the provider handle to itself', async () => {
    await expect(
      new EmailChannelService(new RecordingEmailPort()).send({ ...base, categoryKey: NOTIFICATION_CATEGORY.INVITATION }),
    ).resolves.toBeUndefined();
  });
});
