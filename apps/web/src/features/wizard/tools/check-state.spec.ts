import { describe, expect, it } from 'vitest';
import { API_OUTCOME } from '@/lib/api-outcome';
import { CHECK_EVENT, CHECK_STAGE, INITIAL_CHECK_STATE, checkReducer } from './check-state';

/** *Check my report*'s transitions (task 42.2; row (d)): what is unsent goes first, and a refusal lasts one press. */
describe('checkReducer', () => {
  it('runs at once with nothing unsent, and waits for the queue otherwise', () => {
    expect(checkReducer(INITIAL_CHECK_STATE, { type: CHECK_EVENT.PRESSED, unsent: false }).stage).toBe(CHECK_STAGE.RUNNING);
    expect(checkReducer(INITIAL_CHECK_STATE, { type: CHECK_EVENT.PRESSED, unsent: true }).stage).toBe(CHECK_STAGE.WAITING);
  });

  it('runs once the queue drains, and says it is stuck where the answers cannot go — then runs if they go after all', () => {
    const waiting = checkReducer(INITIAL_CHECK_STATE, { type: CHECK_EVENT.PRESSED, unsent: true });
    expect(checkReducer(waiting, { type: CHECK_EVENT.QUEUE_DRAINED }).stage).toBe(CHECK_STAGE.RUNNING);
    const stuck = checkReducer(waiting, { type: CHECK_EVENT.QUEUE_STUCK });
    expect(stuck.stage).toBe(CHECK_STAGE.STUCK);
    expect(checkReducer(stuck, { type: CHECK_EVENT.QUEUE_DRAINED }).stage).toBe(CHECK_STAGE.RUNNING);
  });

  it('ignores the queue when nothing was pressed', () => {
    expect(checkReducer(INITIAL_CHECK_STATE, { type: CHECK_EVENT.QUEUE_DRAINED })).toBe(INITIAL_CHECK_STATE);
    expect(checkReducer(INITIAL_CHECK_STATE, { type: CHECK_EVENT.QUEUE_STUCK })).toBe(INITIAL_CHECK_STATE);
  });

  it('keeps a refused run’s outcome until the next press, and forgets it on a settled one', () => {
    const refused = { status: API_OUTCOME.Unreachable } as const;
    const failed = checkReducer(
      { stage: CHECK_STAGE.RUNNING, failure: null },
      { type: CHECK_EVENT.RUN_SETTLED, outcome: refused },
    );
    expect(failed).toEqual({ stage: CHECK_STAGE.IDLE, failure: refused });
    expect(checkReducer(failed, { type: CHECK_EVENT.PRESSED, unsent: false }).failure).toBeNull();
    expect(
      checkReducer(
        { stage: CHECK_STAGE.RUNNING, failure: null },
        { type: CHECK_EVENT.RUN_SETTLED, outcome: { status: API_OUTCOME.Ok, value: null, messages: [] } },
      ).failure,
    ).toBeNull();
  });
});
