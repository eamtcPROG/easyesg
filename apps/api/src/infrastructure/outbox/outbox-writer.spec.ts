import type { QueryRunner } from 'typeorm';
import { writeOutboxEvent, writeOutboxEventOnce } from './outbox-writer';

const runner = (written: boolean) => {
  const query = jest.fn().mockResolvedValue(written ? [{ idempotency_key: 'k' }] : []);
  return { runner: { query } as unknown as QueryRunner, query };
};

/**
 * Both writers refuse a key the queue could not take before writing anything (task 206) — the dispatcher would
 * otherwise meet it, where it once failed every row in the batch beside it. Which keys those are is
 * `queueable-key.spec.ts`'s; this holds that each writer asks.
 */
describe('writeOutboxEvent', () => {
  it('writes a key the queue can take', async () => {
    const { runner: accepted, query } = runner(true);
    await expect(
      writeOutboxEvent(accepted, { eventType: 'e', payload: {}, organizationId: null, idempotencyKey: 'e/a/1' }),
    ).resolves.toBe('e/a/1');
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('refuses a three-part colon key before writing anything — the form BullMQ admits only as a legacy exception', async () => {
    const { runner: refused, query } = runner(true);
    await expect(
      writeOutboxEvent(refused, { eventType: 'e', payload: {}, organizationId: null, idempotencyKey: 'e:a:1' }),
    ).rejects.toThrow(/'e:a:1'/u);
    expect(query).not.toHaveBeenCalled();
  });

  it('refuses an empty key rather than falling back to a random one', async () => {
    const { runner: refused, query } = runner(true);
    await expect(
      writeOutboxEvent(refused, { eventType: 'e', payload: {}, organizationId: null, idempotencyKey: '' }),
    ).rejects.toThrow(/may not be empty/u);
    expect(query).not.toHaveBeenCalled();
  });
});

/** `writeOutboxEventOnce` (task 51.2): one row per key, and a key the queue could not take refused where it is made. */
describe('writeOutboxEventOnce', () => {
  it('says whether the row was new, by what the conflict clause returned', async () => {
    await expect(
      writeOutboxEventOnce(runner(true).runner, { eventType: 'e', payload: {}, organizationId: null, idempotencyKey: 'e/2026-10-09' }),
    ).resolves.toBe(true);
    await expect(
      writeOutboxEventOnce(runner(false).runner, { eventType: 'e', payload: {}, organizationId: null, idempotencyKey: 'e/2026-10-09' }),
    ).resolves.toBe(false);
  });

  it('refuses a key with a colon before writing anything', async () => {
    const { runner: refused, query } = runner(true);
    await expect(
      writeOutboxEventOnce(refused, { eventType: 'e', payload: {}, organizationId: null, idempotencyKey: 'e:2026-10-09' }),
    ).rejects.toThrow(/'e:2026-10-09'/u);
    expect(query).not.toHaveBeenCalled();
  });
});
