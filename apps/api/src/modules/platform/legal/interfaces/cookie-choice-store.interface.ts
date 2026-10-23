import type { RecordedCookieChoice } from '../models/cookie-choice.model';

export const COOKIE_CHOICE_STORE = Symbol('COOKIE_CHOICE_STORE');

/**
 * `identity.cookie_choice` (task 223; §12.5.6's task-223 row (2) … (4)) — the request tier records an answer and the
 * worker purges the old ones; neither updates one.
 *
 * **The purge counts calendar months in the database**, `interval`, so a row and the cookie it proves end on the same
 * calendar date — the web sets the cookie's expiry the same way — rather than on a figure of seconds that drifts a day
 * across every month that is not thirty days long.
 */
export interface CookieChoiceStore {
  record(input: { readonly policyVersion: string; readonly accountId: string | null }): Promise<RecordedCookieChoice>;

  /** Deletes every answer given more than `months` calendar months before `asOf`, and answers how many it deleted. */
  purgeOlderThan(input: { readonly asOf: Date; readonly months: number }): Promise<number>;
}
