import { describe, expect, it } from 'vitest';
import { AFTER_LOSS, LOSS, RECONNECT_BASE, afterLoss } from './reconnect-policy';

const DROP = { kind: LOSS.CLOSED, code: 1006 } as const;

/** §12.5.6's task-149 row (3), (4): retry with full jitter from the shortest accelerated interval, or park. */
describe('afterLoss', () => {
  it('starts from the shortest accelerated interval, which is S-16 half a minute', () => {
    expect(RECONNECT_BASE).toBe(30_000);
  });

  it.each([
    ['a replica shutting down', 1001],
    ['an abnormal drop, which is also how a refused upgrade arrives', 1006],
  ])('retries after %s, anywhere from at once to twice the base', (_, code) => {
    const loss = { kind: LOSS.CLOSED, code };
    expect(afterLoss({ loss, losses: 1, random: () => 0 })).toEqual({ kind: AFTER_LOSS.RETRY, delay: 0 });
    expect(afterLoss({ loss, losses: 1, random: () => 0.999_999 })).toEqual({
      kind: AFTER_LOSS.RETRY,
      delay: 59_999,
    });
  });

  it('doubles the ceiling per consecutive loss and never waits past five minutes', () => {
    expect(afterLoss({ loss: DROP, losses: 2, random: () => 0.5 })).toEqual({
      kind: AFTER_LOSS.RETRY,
      delay: 60_000,
    });
    expect(afterLoss({ loss: DROP, losses: 40, random: () => 0.999_999 })).toEqual({
      kind: AFTER_LOSS.RETRY,
      delay: 299_999,
    });
  });

  it('never retries at a fixed wait: the draw is what desynchronises a failover', () => {
    const delays = [0.1, 0.5, 0.9].map((draw) => afterLoss({ loss: DROP, losses: 1, random: () => draw }));
    expect(new Set(delays.map((decision) => (decision.kind === AFTER_LOSS.RETRY ? decision.delay : null))).size).toBe(3);
  });

  it('retries a ticket that could not be minted', () => {
    expect(afterLoss({ loss: { kind: LOSS.FAILED }, losses: 1, random: () => 0.5 })).toEqual({
      kind: AFTER_LOSS.RETRY,
      delay: 30_000,
    });
  });

  it.each([
    ['a socket superseded by a newer connection', { kind: LOSS.CLOSED, code: 4001 }],
    ['a close for a client frame', { kind: LOSS.CLOSED, code: 1008 }],
    ['a ticket the session is refused', { kind: LOSS.REFUSED }],
  ] as const)('parks after %s', (_, loss) => {
    expect(afterLoss({ loss, losses: 1 })).toEqual({ kind: AFTER_LOSS.PARK });
  });
});
