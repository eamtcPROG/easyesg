import type { DeliverNoticeCommand, NotificationDeliveryPort } from '@api/contracts/notification-delivery.port';
import type { JobContext } from '@api/infrastructure/queue/job-handler';
import { AdminInvitationEmailHandler } from './admin-invitation-email.handler';

/**
 * An operator's invitation to the console (task 67.4; its category since task 49.2, handed to the notification
 * module's delivery since task 50.1.4) — in the source locale, the console being Romanian-only (OQ-42), linked to
 * A-20 on the console, and a platform notice: it names no organization, so it is recorded under row (17)'s reserved
 * id. The category key is asserted as the wire value, so a swap with the organization invitation's fails here.
 */
describe('AdminInvitationEmailHandler (tasks 67.4, 49.2, 50.1.4)', () => {
  const payload = {
    invitationId: 'invitation-1',
    email: 'operator@example.md',
    token: 'token/1',
    organizationId: null,
    occurredAtMicros: 1_790_726_400_000_000,
  };

  const handled = async (event: Record<string, unknown>): Promise<DeliverNoticeCommand[]> => {
    const delivered: DeliverNoticeCommand[] = [];
    const port: NotificationDeliveryPort = {
      deliver: (command) => {
        delivered.push(command);
        return Promise.resolve();
      },
    };
    await new AdminInvitationEmailHandler(port).handle(event, { jobId: 'outbox-1' } as JobContext);
    return delivered;
  };

  it("hands over the operator's invitation, to the console, in Romanian, belonging to no organization", async () => {
    expect(await handled(payload)).toEqual([
      {
        issuanceKey: 'outbox-1',
        occurredAtMicros: 1_790_726_400_000_000,
        categoryKey: 'platform.admin_invitation',
        recipient: { address: 'operator@example.md', locale: 'ro' },
        application: 'console',
        deepLink: '/invitation',
        linkPath: '/invitation/token%2F1',
        params: {},
      },
    ]);
  });

  it.each([
    ['no token', { ...payload, token: undefined }],
    ['no time', { ...payload, occurredAtMicros: undefined }],
  ])('fails a payload with %s rather than sending to a guess', async (_label, broken) => {
    await expect(handled(broken)).rejects.toThrow('payload');
  });
});
