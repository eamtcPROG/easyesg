/**
 * What the unread count's poll holds between runs (task 50.2.1): the count last read, and how many polls in a row
 * have failed since.
 *
 * **The failures are counted here because the query cannot count them.** TanStack Query resets a query's
 * `fetchFailureCount` at the start of every fetch (5.101.4's `fetchState`, read in the installed source), so with retries off it
 * never passes one — and OQ-36's backoff needs the run of failures across polls. Settling each poll against the one
 * before it keeps that run in the query's own data, where every reader of the count shares it.
 *
 * **A failed poll keeps the count it last knew.** A badge that disappears whenever one request fails would tell a
 * reader something changed when nothing did; the next good read replaces it.
 */
export interface UnreadCountState {
  /** `null` until a poll has succeeded once. */
  readonly unread: number | null;
  readonly failures: number;
}

export const settleUnreadCount = (input: {
  readonly previous: UnreadCountState | undefined;
  /** What this poll read — `null` when it could not. */
  readonly read: number | null;
}): UnreadCountState =>
  input.read === null
    ? { unread: input.previous?.unread ?? null, failures: (input.previous?.failures ?? 0) + 1 }
    : { unread: input.read, failures: 0 };
