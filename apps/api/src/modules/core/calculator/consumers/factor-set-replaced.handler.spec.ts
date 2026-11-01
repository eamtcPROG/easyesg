import type { NotifyFactorSetReplaced } from '../use-cases/notify-factor-set-replaced.use-case';
import { FactorSetReplacedHandler } from './factor-set-replaced.handler';

/** The adapter over `NotifyFactorSetReplaced` (task 37.3): the publisher's payload validated rather than cast. */
describe('FactorSetReplacedHandler (task 37.3)', () => {
  const payload = { scope: 'md', leavingRevision: 1, enteringRevision: 2, organizationId: null, occurredAtMicros: 1 };

  const build = () => {
    const execute = jest.fn().mockResolvedValue(undefined);
    return { handler: new FactorSetReplacedHandler({ execute } as unknown as NotifyFactorSetReplaced), execute };
  };

  it('hands on the country and the two revisions', async () => {
    const { handler, execute } = build();
    await handler.handle(payload);

    expect(execute).toHaveBeenCalledWith({ country: 'md', leavingRevision: 1, enteringRevision: 2 });
  });

  it.each([
    ['no scope', { ...payload, scope: undefined }],
    ['a revision as text', { ...payload, leavingRevision: '1' }],
    ['a revision of zero', { ...payload, enteringRevision: 0 }],
  ])('refuses a payload with %s', async (_, malformed) => {
    const { handler, execute } = build();

    await expect(handler.handle(malformed)).rejects.toThrow('calculator.factor_set_replaced payload');
    expect(execute).not.toHaveBeenCalled();
  });
});
