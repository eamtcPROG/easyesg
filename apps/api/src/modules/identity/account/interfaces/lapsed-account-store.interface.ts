/**
 * What OQ-52's reclaiming sweep removes (task 200; FR-3 AC-7; `architecture.md` §12.5.6's task-200 row).
 *
 * **One operation, and it takes no moment and no window.** Which accounts have lapsed is the database function's to
 * say, by its own clock (row (1)), so a caller cannot widen it to a live account, and the worker's role can do nothing
 * else to the table. Its own narrow port rather than a method on `AccountStore`, which is the request tier's and holds
 * every account operation the worker must never reach (ISP).
 */
export interface LapsedAccountStore {
  /** Deletes every account unverified, or in setup, past its seven days, with what cascades from it; answers how many. */
  reclaimLapsed(): Promise<number>;
}

export const LAPSED_ACCOUNT_STORE = Symbol('LAPSED_ACCOUNT_STORE');
