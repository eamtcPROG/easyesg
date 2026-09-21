import type { ConfigService } from '@nestjs/config';
import type { AppConfig } from '@api/config/configuration';
import type { NotificationEmail, NotificationEmailPort } from '@api/contracts/notification-email.port';
import type { JobContext } from '@api/infrastructure/queue/job-handler';
import { AdminInvitationEmailHandler } from './admin-invitation-email.handler';

/**
 * An operator's invitation to the console (task 67.4; its category since task 49.2) — in the source locale, the
 * console being Romanian-only (OQ-42), and linked to A-20 on the console's own origin. The category key is what
 * picks its wording, asserted as the wire value, so a swap with the organization invitation's fails here.
 */
describe('AdminInvitationEmailHandler (tasks 67.4, 49.2)', () => {
  class RecordingEmailPort implements NotificationEmailPort {
    readonly sent: NotificationEmail[] = [];

    send(email: NotificationEmail): Promise<void> {
      this.sent.push(email);
      return Promise.resolve();
    }
  }

  const config = { get: () => 'https://admin.easyesg.md' } as unknown as ConfigService<AppConfig, true>;
  const payload = { invitationId: 'invitation-1', email: 'op@easyesg.md', token: 'token-1' };

  it("sends the operator invitation category's email, in the source locale, with the console's link", async () => {
    const port = new RecordingEmailPort();
    await new AdminInvitationEmailHandler(port, config).handle(payload, { jobId: 'outbox-1' } as JobContext);

    expect(port.sent).toEqual([
      {
        to: 'op@easyesg.md',
        locale: 'ro',
        categoryKey: 'platform.admin_invitation',
        params: { invitationUrl: 'https://admin.easyesg.md/invitation/token-1' },
        idempotencyKey: 'outbox-1',
      },
    ]);
  });

  it('fails a payload missing a field rather than sending to a guess', async () => {
    const port = new RecordingEmailPort();

    await expect(
      new AdminInvitationEmailHandler(port, config).handle({ invitationId: 'i' }, { jobId: 'k' } as JobContext),
    ).rejects.toThrow('payload');
    expect(port.sent).toEqual([]);
  });
});
