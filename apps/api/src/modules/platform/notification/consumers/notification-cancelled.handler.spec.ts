import type { CancelNotification } from '../use-cases/cancel-notification.use-case';
import { NotificationCancelledHandler } from './notification-cancelled.handler';

/**
 * The adapter over `CancelNotification` (task 50.1.3): the payload validated rather than cast, and the key handed on
 * with the organization and the time the dispatcher added beside it.
 */
describe('NotificationCancelledHandler (task 50.1.3)', () => {
  const ORGANIZATION = '44444444-4444-4444-8444-444444444444';
  const OCCURRED_AT = 1_790_640_000_000_000;
  const payload = {
    categoryKey: 'identity.invitation',
    subjectRef: 'invitation:1',
    recipientScope: 'default',
    organizationId: ORGANIZATION,
    occurredAtMicros: OCCURRED_AT,
  };

  const build = () => {
    const execute = jest.fn().mockResolvedValue(undefined);
    return { handler: new NotificationCancelledHandler({ execute } as unknown as CancelNotification), execute };
  };

  it('hands the key on with its organization and the cancellation time', async () => {
    const { handler, execute } = build();
    await handler.handle(payload);

    expect(execute).toHaveBeenCalledWith({
      organizationId: ORGANIZATION,
      categoryKey: 'identity.invitation',
      subjectRef: 'invitation:1',
      recipientScope: 'default',
      cancelledAtMicros: OCCURRED_AT,
    });
  });

  it.each([
    ['a category nobody declared', { ...payload, categoryKey: 'billing.nothing' }],
    ['no subject', { ...payload, subjectRef: undefined }],
    ['no audience', { ...payload, recipientScope: undefined }],
    ['an organization that is not a UUID', { ...payload, organizationId: 'org-1' }],
    ['no time', { ...payload, occurredAtMicros: undefined }],
  ])('fails a payload with %s rather than cancelling a guess', async (_label, broken) => {
    const { handler, execute } = build();

    await expect(handler.handle(broken)).rejects.toThrow('payload');
    expect(execute).not.toHaveBeenCalled();
  });
});
