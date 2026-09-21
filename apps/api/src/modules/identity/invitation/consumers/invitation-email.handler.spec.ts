import type { ConfigService } from '@nestjs/config';
import type { AppConfig } from '@api/config/configuration';
import type { NotificationEmail, NotificationEmailPort } from '@api/contracts/notification-email.port';
import type { JobContext } from '@api/infrastructure/queue/job-handler';
import { InvitationEmailHandler } from './invitation-email.handler';

/**
 * The organization invitation's email (FR-11, FR-57; its category since task 49.2). The category key is what picks
 * its wording now (FR-173), so it is asserted as the wire value; nothing else constructed this handler until the
 * parent close of task 49 found it untested.
 */
describe('InvitationEmailHandler (tasks 26.1, 49.2)', () => {
  class RecordingEmailPort implements NotificationEmailPort {
    readonly sent: NotificationEmail[] = [];

    send(email: NotificationEmail): Promise<void> {
      this.sent.push(email);
      return Promise.resolve();
    }
  }

  const config = { get: () => 'https://app.easyesg.md' } as unknown as ConfigService<AppConfig, true>;
  const payload = {
    invitationId: 'invitation-1',
    organizationName: 'Brutăria',
    email: 'ana@example.md',
    locale: 'ru',
    token: 'token/1',
  };

  it("sends the invitation category's email, in the invitee's language, with the link to accept it", async () => {
    const port = new RecordingEmailPort();
    await new InvitationEmailHandler(port, config).handle(payload, { jobId: 'outbox-1' } as JobContext);

    expect(port.sent).toEqual([
      {
        to: 'ana@example.md',
        locale: 'ru',
        categoryKey: 'identity.invitation',
        params: {
          organizationName: 'Brutăria',
          invitationUrl: 'https://app.easyesg.md/ru/invitation/token%2F1',
        },
        idempotencyKey: 'outbox-1',
      },
    ]);
  });

  it('fails a payload missing a field rather than sending to a guess', async () => {
    const port = new RecordingEmailPort();
    const { token: _token, ...broken } = payload;

    await expect(
      new InvitationEmailHandler(port, config).handle(broken, { jobId: 'outbox-1' } as JobContext),
    ).rejects.toThrow('payload');
    expect(port.sent).toEqual([]);
  });
});
