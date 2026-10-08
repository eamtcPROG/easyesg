import type { QueryRunner } from 'typeorm';
import { writeOutboxEventOnce } from './outbox-writer';

/** `writeOutboxEventOnce` (task 51.2): one row per key, and a key the queue could not take refused where it is made. */
describe('writeOutboxEventOnce', () => {
  const runner = (written: boolean) => {
    const query = jest.fn().mockResolvedValue(written ? [{ idempotency_key: 'k' }] : []);
    return { runner: { query } as unknown as QueryRunner, query };
  };

  it('says whether the row was new, by what the conflict clause returned', async () => {
    await expect(
      writeOutboxEventOnce(runner(true).runner, { eventType: 'e', payload: {}, organizationId: null, idempotencyKey: 'e/2026-10-09' }),
    ).resolves.toBe(true);
    await expect(
      writeOutboxEventOnce(runner(false).runner, { eventType: 'e', payload: {}, organizationId: null, idempotencyKey: 'e/2026-10-09' }),
    ).resolves.toBe(false);
  });

  it('refuses a key with a colon before writing anything — the dispatcher would fail its whole batch on it', async () => {
    const { runner: refused, query } = runner(true);
    await expect(
      writeOutboxEventOnce(refused, { eventType: 'e', payload: {}, organizationId: null, idempotencyKey: 'e:2026-10-09' }),
    ).rejects.toThrow(/may not contain ':'/u);
    expect(query).not.toHaveBeenCalled();
  });
});
