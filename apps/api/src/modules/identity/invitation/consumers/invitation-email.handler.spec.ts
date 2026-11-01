import type { DeliverNoticeCommand, NotificationDeliveryPort } from '@api/contracts/notification-delivery.port';
import type { JobContext } from '@api/infrastructure/queue/job-handler';
import { InvitationEmailHandler } from './invitation-email.handler';

/**
 * The organization invitation's notice (FR-11, FR-57; its category since task 49.2, handed to the notification
 * module's delivery since task 50.1.4). The category key picks its wording (FR-173), so it is asserted as the wire
 * value; so is the recipient, an address and a language, since the invitee may hold no account (row (16)).
 */
describe('InvitationEmailHandler (tasks 26.1, 49.2, 50.1.4)', () => {
  const ORGANIZATION = '44444444-4444-4444-8444-444444444444';
  const payload = {
    invitationId: 'invitation-1',
    organizationName: 'Brutăria',
    email: 'ana@example.md',
    locale: 'ru',
    token: 'token/1',
    organizationId: ORGANIZATION,
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
    await new InvitationEmailHandler(port).handle(event, { jobId: 'outbox-1' } as JobContext);
    return delivered;
  };

  it("hands over the invitation for the invitee's address and language, in its organization", async () => {
    expect(await handled(payload)).toEqual([
      {
        issuanceKey: 'outbox-1',
        occurredAtMicros: 1_790_726_400_000_000,
        organizationId: ORGANIZATION,
        categoryKey: 'identity.invitation',
        recipient: { address: 'ana@example.md', locale: 'ru' },
        application: 'web',
        deepLink: '/invitation',
        // A path segment, encoded — `apps/web`'s `invitation/[token]` route.
        linkPath: '/invitation/token%2F1',
        params: { organizationName: 'Brutăria' },
      },
    ]);
  });

  it.each([
    ['no token', { ...payload, token: undefined }],
    ['no organization', { ...payload, organizationId: null }],
    ['no time', { ...payload, occurredAtMicros: undefined }],
  ])('fails a payload with %s rather than sending to a guess', async (_label, broken) => {
    await expect(handled(broken)).rejects.toThrow('payload');
  });
});
