import { describe, expect, it } from 'vitest';
import { INITIAL_REFRESH_POLL, REFRESH_POLL_EVENT, refreshPollReducer, type RefreshPollState } from './refresh-poll-state';

const started = (state: RefreshPollState) => refreshPollReducer(state, { type: REFRESH_POLL_EVENT.REFRESH_STARTED });
const settled = (state: RefreshPollState, failed: boolean) =>
  refreshPollReducer(state, { type: REFRESH_POLL_EVENT.RENDER_SETTLED, failed });

/** A server-rendered surface's poll (task 149): each settled refresh a new round, failures counted in a row. */
describe('refreshPollReducer', () => {
  it('starts a new round with each refresh that settles, even when nothing else changed', () => {
    const once = settled(started(INITIAL_REFRESH_POLL), false);
    const twice = settled(started(once), false);

    expect(once).toEqual({ inFlight: false, failures: 0, round: 1 });
    expect(twice).toEqual({ inFlight: false, failures: 0, round: 2 });
  });

  it('counts failed reads in a row, and a read that answers ends the run', () => {
    const failing = settled(started(settled(started(INITIAL_REFRESH_POLL), true)), true);
    expect(failing.failures).toBe(2);
    expect(settled(started(failing), false).failures).toBe(0);
  });

  it('ignores a render nothing it started asked for', () => {
    expect(settled(INITIAL_REFRESH_POLL, true)).toBe(INITIAL_REFRESH_POLL);
  });

  it('keeps one refresh in flight however many are asked for', () => {
    const inFlight = started(INITIAL_REFRESH_POLL);
    expect(started(inFlight)).toBe(inFlight);
  });

  it('starts a new round when a tick is skipped because the tab was hidden, keeping the failures', () => {
    const failing = settled(started(INITIAL_REFRESH_POLL), true);
    expect(refreshPollReducer(failing, { type: REFRESH_POLL_EVENT.SKIPPED_HIDDEN })).toEqual({
      inFlight: false,
      failures: 1,
      round: 2,
    });
  });
});
