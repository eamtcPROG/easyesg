import { Logger } from '@nestjs/common';
import type { JobContext } from '@api/infrastructure/queue/job-handler';
import type { DeliverNotification } from '../use-cases/deliver-notification.use-case';
import { NotificationRaisedHandler } from './notification-raised.handler';

/**
 * The adapter over `DeliverNotification` (task 49.3): the payload validated rather than cast, the notice handed
 * on whole, and the recipients who named no account said. The flow's decisions are the use case's spec.
 */
describe('NotificationRaisedHandler (task 49.3)', () => {
  const context = { jobId: 'outbox-key-1' } as JobContext;
  const payload = {
    categoryKey: 'identity.invitation',
    recipientUserIds: ['11111111-1111-4111-8111-111111111111'],
    subjectRef: 'invitation:1',
    deepLink: '/invitation/abc',
    params: { organizationName: 'Brutăria' },
  };

  const build = (unresolved: readonly string[] = []) => {
    const execute = jest.fn().mockResolvedValue({ unresolved });
    return { handler: new NotificationRaisedHandler({ execute } as unknown as DeliverNotification), execute };
  };

  let warned: string[] = [];
  beforeEach(() => {
    warned = [];
    jest.spyOn(Logger.prototype, 'warn').mockImplementation((message: unknown) => {
      warned.push(String(message));
    });
  });
  afterEach(() => jest.restoreAllMocks());

  it('hands the notice on whole, keyed by the job — the outbox row', async () => {
    const { handler, execute } = build();
    await handler.handle(payload, context);

    expect(execute).toHaveBeenCalledWith({ notice: payload, deliveryId: 'outbox-key-1' });
    expect(warned).toEqual([]);
  });

  it('says how many recipients named no account', async () => {
    const { handler } = build(['33333333-3333-4333-8333-333333333333']);
    await handler.handle(payload, context);

    expect(warned.join('\n')).toContain('1 recipient(s) name no account');
  });

  it.each([
    ['a category nobody declared', { ...payload, categoryKey: 'billing.nothing' }],
    ['no recipient list', { ...payload, recipientUserIds: undefined }],
    ['a deep link that is not a path', { ...payload, deepLink: 'https://elsewhere.example/x' }],
    ['no params', { ...payload, params: null }],
  ])('fails a payload with %s rather than delivering to a guess', async (_label, broken) => {
    const { handler, execute } = build();

    await expect(handler.handle(broken, context)).rejects.toThrow('payload');
    expect(execute).not.toHaveBeenCalled();
  });
});
