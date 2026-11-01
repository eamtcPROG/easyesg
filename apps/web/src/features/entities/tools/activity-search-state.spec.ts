import { describe, expect, it } from 'vitest';
import {
  ACTIVITY_SEARCH_EVENT,
  INITIAL_ACTIVITY_SEARCH,
  activitySearchReducer,
  offeredActivities,
  type ActivitySearchEvent,
} from './activity-search-state';

const BREAD = { code: '10.71', label: 'Fabricarea pâinii' };
const RUSKS = { code: '10.72', label: 'Fabricarea biscuiţilor' };
const CEREALS = { code: '01.11', label: 'Cultivarea cerealelor' };

const run = (...events: ActivitySearchEvent[]) => events.reduce(activitySearchReducer, INITIAL_ACTIVITY_SEARCH);
const typed = (query: string, asked: number): ActivitySearchEvent => ({
  kind: ACTIVITY_SEARCH_EVENT.TYPED,
  query,
  asked,
});
const answered = (asked: number, ...matches: (typeof BREAD)[]): ActivitySearchEvent => ({
  kind: ACTIVITY_SEARCH_EVENT.ANSWERED,
  asked,
  matches,
});

describe('activitySearchReducer', () => {
  it('keeps the latest search’s answer', () => {
    expect(run(typed('brut', 1), answered(1, BREAD, RUSKS)).results).toEqual([BREAD, RUSKS]);
  });

  it('drops an answer that arrives after a later search was asked', () => {
    // *brut* answered after *brutar* was typed: the reader has moved on, and the list must not move back.
    const state = run(typed('brut', 1), typed('brutar', 2), answered(2, BREAD), answered(1, BREAD, RUSKS));

    expect(state.results).toEqual([BREAD]);
    expect(state.query).toBe('brutar');
  });

  it('keeps the last answer on screen while the next search is out', () => {
    expect(run(typed('brut', 1), answered(1, BREAD, RUSKS), typed('brutx', 2)).results).toEqual([BREAD, RUSKS]);
  });

  it('clears on a choice, and drops what was still out', () => {
    const state = run(typed('brut', 1), { kind: ACTIVITY_SEARCH_EVENT.CHOSEN, asked: 2 }, answered(1, BREAD));

    expect(state).toEqual({ query: '', asked: 2, results: [] });
  });
});

describe('offeredActivities', () => {
  it('offers the suggestions with nothing typed, whatever was answered before', () => {
    const state = run(typed('brut', 1), answered(1, BREAD), typed('  ', 2));

    expect(offeredActivities({ state, suggestions: [CEREALS, BREAD], chosen: [] })).toEqual([CEREALS, BREAD]);
  });

  it('offers the latest answer once something is typed', () => {
    const state = run(typed('brut', 1), answered(1, BREAD, RUSKS));

    expect(offeredActivities({ state, suggestions: [CEREALS], chosen: [] })).toEqual([BREAD, RUSKS]);
  });

  it('never offers a code already chosen, from either list', () => {
    expect(offeredActivities({ state: INITIAL_ACTIVITY_SEARCH, suggestions: [CEREALS, BREAD], chosen: [BREAD] })).toEqual(
      [CEREALS],
    );
    const state = run(typed('brut', 1), answered(1, BREAD, RUSKS));
    expect(offeredActivities({ state, suggestions: [], chosen: [BREAD] })).toEqual([RUSKS]);
  });
});
