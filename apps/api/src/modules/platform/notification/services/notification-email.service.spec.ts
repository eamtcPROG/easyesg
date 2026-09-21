import type { EmailDispatched, EmailMessage, EmailPort } from '@api/contracts/email.port';
import { NOTIFICATION_CATEGORY } from '@api/contracts/notification.port';
import { NotificationEmailService } from './notification-email.service';

/**
 * The one caller of `EmailPort` (task 49.2). What it owes a producer today is small and exact: the category's
 * wording unless a second one is named, and everything else the provider needs, unchanged.
 */
describe('NotificationEmailService (task 49.2)', () => {
  class RecordingEmailPort implements EmailPort {
    readonly sent: EmailMessage[] = [];

    send(message: EmailMessage): Promise<EmailDispatched> {
      this.sent.push(message);
      return Promise.resolve({ providerMessageId: 'provider-1' });
    }
  }

  const base = {
    to: 'ana@example.md',
    locale: 'ro',
    params: { verificationUrl: 'https://app.easyesg.md/ro/verify?token=t' },
    idempotencyKey: 'outbox-1',
  } as const;

  it("sends the category's own wording when no second one is named", async () => {
    const provider = new RecordingEmailPort();

    await new NotificationEmailService(provider).send({
      ...base,
      categoryKey: NOTIFICATION_CATEGORY.EMAIL_VERIFICATION,
    });

    expect(provider.sent).toEqual([{ ...base, templateKey: 'identity.email_verification' }]);
  });

  it('sends the second wording a category names, and not its key', async () => {
    const provider = new RecordingEmailPort();

    await new NotificationEmailService(provider).send({
      ...base,
      categoryKey: NOTIFICATION_CATEGORY.PASSWORD_RESET,
      templateKey: 'identity.password_setup',
    });

    expect(provider.sent[0].templateKey).toBe('identity.password_setup');
  });

  // The provider's handle is the module's to keep (51.4): a producer is given nothing to depend on.
  it('resolves with nothing once the provider has the message', async () => {
    await expect(
      new NotificationEmailService(new RecordingEmailPort()).send({
        ...base,
        categoryKey: NOTIFICATION_CATEGORY.INVITATION,
      }),
    ).resolves.toBeUndefined();
  });

  it('lets a provider failure reach the job, so the queue retries it', async () => {
    const failing: EmailPort = { send: () => Promise.reject(new Error('provider down')) };

    await expect(
      new NotificationEmailService(failing).send({ ...base, categoryKey: NOTIFICATION_CATEGORY.INVITATION }),
    ).rejects.toThrow('provider down');
  });
});
