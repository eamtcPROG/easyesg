import type { NaceCodeMatch } from '@easyesg/contracts';

/**
 * The activity picker's search, as one value and the events that move it (28 Sep 2026).
 *
 * **One reducer because the query and the answer move together**: the picker set the query and cleared the list in
 * one handler, and each keystroke's answer was written whenever it came back. A search is a round trip, so answers
 * arrive out of order — *brut*'s can land after *brutar*'s and show the reader a list for letters they have since
 * typed past. Each search carries the number it was asked under, and **only the latest one's answer is kept**.
 *
 * **The last answer stays while the next is out**, so the list the reader is looking at does not blank on every letter;
 * the picker's busy mark says it is being refreshed (§8.1's *loading — refresh*).
 *
 * **Nothing typed offers the suggestions**, the classifier's first classes the record read with the page, whatever an
 * earlier search answered. And a code already chosen is never offered again: storing one twice is not something the api
 * refuses, so the picker makes it unrepresentable.
 */
export const ACTIVITY_SEARCH_EVENT = {
  /** The reader changed the query; a search for it is asked under `asked`, unless it is empty. */
  TYPED: 'typed',
  /** A search came back. */
  ANSWERED: 'answered',
  /** The reader chose a code: the box clears, and whatever is still out is no longer wanted. */
  CHOSEN: 'chosen',
} as const;

export type ActivitySearchEvent =
  | { readonly kind: typeof ACTIVITY_SEARCH_EVENT.TYPED; readonly query: string; readonly asked: number }
  | {
      readonly kind: typeof ACTIVITY_SEARCH_EVENT.ANSWERED;
      readonly asked: number;
      readonly matches: readonly NaceCodeMatch[];
    }
  | { readonly kind: typeof ACTIVITY_SEARCH_EVENT.CHOSEN; readonly asked: number };

export interface ActivitySearchState {
  readonly query: string;
  /** The number the latest search was asked under; an answer to any other is stale. */
  readonly asked: number;
  /** The latest answer kept — to the search still out, or to the one before it. */
  readonly results: readonly NaceCodeMatch[];
}

export const INITIAL_ACTIVITY_SEARCH: ActivitySearchState = { query: '', asked: 0, results: [] };

export const activitySearchReducer = (
  state: ActivitySearchState,
  event: ActivitySearchEvent,
): ActivitySearchState => {
  switch (event.kind) {
    case ACTIVITY_SEARCH_EVENT.TYPED:
      return { query: event.query, asked: event.asked, results: state.results };
    case ACTIVITY_SEARCH_EVENT.ANSWERED:
      return event.asked === state.asked ? { ...state, results: event.matches } : state;
    case ACTIVITY_SEARCH_EVENT.CHOSEN:
      return { query: '', asked: event.asked, results: [] };
  }
};

/** What the picker offers now: the suggestions with nothing typed, the latest answer otherwise — less what is chosen. */
export const offeredActivities = ({
  state,
  suggestions,
  chosen,
}: {
  readonly state: ActivitySearchState;
  readonly suggestions: readonly NaceCodeMatch[];
  readonly chosen: readonly NaceCodeMatch[];
}): readonly NaceCodeMatch[] => {
  const held = new Set(chosen.map((match) => match.code));
  const source = state.query.trim() === '' ? suggestions : state.results;
  return source.filter((match) => !held.has(match.code));
};
