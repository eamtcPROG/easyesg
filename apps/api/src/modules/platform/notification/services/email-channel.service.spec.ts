import {
  EMAIL_FAILURE,
  EmailSendFailed,
  type EmailDispatched,
  type EmailMessage,
  type EmailPort,
} from '@api/contracts/email.port';
import { NOTIFICATION_CATEGORY } from '@api/contracts/notification.port';
import { FakeSuppressionStore } from '@api/testing/fake-suppression-store';
import { DELIVERY_OUTCOME } from '../models/notification-record.model';
import { EmailChannelService } from './email-channel.service';

/**
 * The one caller of `EmailPort` (tasks 49.2, 49.3): the category's own wording unless a second is named —
 * and, since task 51.4, both ends of FR-171, which is why they are specified here rather than at a caller.
 */
describe('EmailChannelService (task 49.3)', () => {
  class RecordingEmailPort implements EmailPort {
    readonly sent: EmailMessage[] = [];

    send(message: EmailMessage): Promise<EmailDispatched> {
      this.sent.push(message);
      return Promise.resolve({ providerMessageId: 'provider-1' });
    }
  }

  /** A port that refuses, the way an adapter reports a refusal: one of `EMAIL_FAILURE`'s two, never a vendor's. */
  class RefusingEmailPort implements EmailPort {
    constructor(private readonly failure: EmailSendFailed) {}
    attempts = 0;

    send(): Promise<EmailDispatched> {
      this.attempts += 1;
      return Promise.reject(this.failure);
    }
  }

  const base = { to: 'ana@example.md', locale: 'ro', params: { link: 'x' }, idempotencyKey: 'k' } as const;

  const suppression = () => new FakeSuppressionStore();
  const channel = (port: EmailPort, store = suppression()) => new EmailChannelService(port, store);

  it("hands the provider the category's key as the wording, and everything else unchanged", async () => {
    const provider = new RecordingEmailPort();
    await channel(provider).send({ ...base, categoryKey: NOTIFICATION_CATEGORY.INVITATION });

    expect(provider.sent).toEqual([{ ...base, templateKey: 'identity.invitation' }]);
  });

  it('hands it the second wording a category names instead', async () => {
    const provider = new RecordingEmailPort();
    await channel(provider).send({
      ...base,
      categoryKey: NOTIFICATION_CATEGORY.PASSWORD_RESET,
      templateKey: 'identity.password_setup',
    });

    expect(provider.sent[0].templateKey).toBe('identity.password_setup');
  });

  it('keeps the provider handle to itself, and answers only what became of the message', async () => {
    await expect(
      channel(new RecordingEmailPort()).send({ ...base, categoryKey: NOTIFICATION_CATEGORY.INVITATION }),
    ).resolves.toEqual({ outcome: DELIVERY_OUTCOME.ACCEPTED });
  });

  // ── FR-171 and NFR-107 (task 51.4) ──────────────────────────────────────────────────────────────
  describe('a refusal, and the address behind it', () => {
    const bounce = new EmailSendFailed(EMAIL_FAILURE.HARD_BOUNCE, '550 5.1.1 no such user');
    const invitation = { ...base, categoryKey: NOTIFICATION_CATEGORY.INVITATION } as const;

    it('suppresses the address on its FIRST hard bounce, and says the send bounced', async () => {
      const store = suppression();
      const port = new RefusingEmailPort(bounce);

      await expect(channel(port, store).send(invitation)).resolves.toEqual({
        outcome: DELIVERY_OUTCOME.BOUNCED,
      });
      expect([...store.suppressed.keys()]).toEqual(['ana@example.md']);
      expect(store.suppressed.get('ana@example.md')?.detail).toBe('550 5.1.1 no such user');
    });

    it('refuses the next message to a suppressed address without asking the provider', async () => {
      const store = suppression();
      await channel(new RefusingEmailPort(bounce), store).send(invitation);

      const second = new RecordingEmailPort();
      await expect(channel(second, store).send(invitation)).resolves.toEqual({
        outcome: DELIVERY_OUTCOME.SUPPRESSED,
      });
      // The point of suppressing at all: the provider is never asked a second time.
      expect(second.sent).toEqual([]);
    });

    it('suppresses by the normalised address, so a different spelling is refused too', async () => {
      const store = suppression();
      await channel(new RefusingEmailPort(bounce), store).send({ ...invitation, to: 'Ana@Example.md' });

      const second = new RecordingEmailPort();
      await channel(second, store).send({ ...invitation, to: 'ana@example.md' });

      expect(second.sent).toEqual([]);
    });

    // NFR-107's asymmetry, and the reason the two failures are one vocabulary: this one must reach BullMQ,
    // where the bounded exponential retry lives. Swallowing it here would lose the message silently.
    it('rethrows a transient failure, and suppresses nothing', async () => {
      const store = suppression();
      const port = new RefusingEmailPort(new EmailSendFailed(EMAIL_FAILURE.TRANSIENT, '451 try again'));

      await expect(channel(port, store).send(invitation)).rejects.toThrow(EmailSendFailed);
      expect([...store.suppressed.keys()]).toEqual([]);
    });
  });
});
