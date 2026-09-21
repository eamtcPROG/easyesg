import { Logger } from '@nestjs/common';
import type { JobContext } from '@api/infrastructure/queue/job-handler';
import type { DeliverNotification } from '../use-cases/deliver-notification.use-case';
import { NotificationRaisedHandler } from './notification-raised.handler';

/**
 * The adapter over `DeliverNotification` (tasks 49.3, 50.1.1): the payload validated rather than cast, the notice
 * handed on whole with the organization the dispatcher added beside it, and the recipients who named no account
 * said. The flow's decisions are the use case's spec.
 */
describe('NotificationRaisedHandler (tasks 49.3, 50.1.1)', () => {
  const context = { jobId: 'outbox-key-1' } as JobContext;
  const ORGANIZATION = '44444444-4444-4444-8444-444444444444';
  const notice = {
    categoryKey: 'identity.invitation',
    recipientUserIds: ['11111111-1111-4111-8111-111111111111'],
    subjectRef: 'invitation:1',
    recipientScope: 'default',
    deepLink: '/invitation/abc',
    params: { organizationName: 'Brutăria' },
  };
  /** What the dispatcher enqueues: the outbox row's payload, and the row's organization beside it. */
  const payload = { ...notice, organizationId: ORGANIZATION };

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

  it('hands the notice on whole, with its organization, keyed by the job — the outbox row', async () => {
    const { handler, execute } = build();
    await handler.handle(payload, context);

    expect(execute).toHaveBeenCalledWith({ notice, organizationId: ORGANIZATION, deliveryId: 'outbox-key-1' });
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
    ['no audience', { ...payload, recipientScope: undefined }],
    ['no organization', { ...payload, organizationId: null }],
    ['an organization that is not a UUID', { ...payload, organizationId: 'org-1' }],
    ['a deep link that is not a path', { ...payload, deepLink: 'https://elsewhere.example/x' }],
    ['no params', { ...payload, params: null }],
  ])('fails a payload with %s rather than delivering to a guess', async (_label, broken) => {
    const { handler, execute } = build();

    await expect(handler.handle(broken, context)).rejects.toThrow('payload');
    expect(execute).not.toHaveBeenCalled();
  });
});
