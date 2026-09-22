import type { DeliverNoticeCommand, NotificationDeliveryPort } from '@api/contracts/notification-delivery.port';
import type { JobContext } from '@api/infrastructure/queue/job-handler';
import { VerificationEmailHandler } from './verification-email.handler';

/**
 * The verification notice the handler hands over (task 50.1.4; FR-3; §12.5.6's task-50.1 rows (14) … (16)): the
 * account as recipient, the issuance as its key, and the token in the path the email carries and nowhere in the one
 * kept in the clear. `registration.e2e-spec.ts` drives it over a real outbox row and the real delivery.
 */
describe('VerificationEmailHandler (task 50.1.4)', () => {
  const context = { jobId: 'identity.email_verification.requested:account-1:1790726400000' } as JobContext;
  const payload = {
    accountId: 'account-1',
    email: 'ana@example.md',
    locale: 'ro',
    token: 'token-1',
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
    await new VerificationEmailHandler(port).handle(event, context);
    return delivered;
  };

  it('hands the account the verification notice, its token in the sent path alone', async () => {
    expect(await handled(payload)).toEqual([
      {
        issuanceKey: context.jobId,
        occurredAtMicros: 1_790_726_400_000_000,
        categoryKey: 'identity.email_verification',
        recipient: { accountId: 'account-1' },
        application: 'web',
        deepLink: '/verify',
        linkPath: '/verify?token=token-1',
        params: {},
      },
    ]);
  });

  it.each([
    ['no account', { ...payload, accountId: undefined }],
    ['no token', { ...payload, token: undefined }],
    ['no time', { ...payload, occurredAtMicros: undefined }],
  ])('fails a payload with %s rather than sending to a guess', async (_label, broken) => {
    await expect(handled(broken)).rejects.toThrow('payload');
  });
});
