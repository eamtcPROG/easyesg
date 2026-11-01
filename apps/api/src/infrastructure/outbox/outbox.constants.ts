/**
 * Dispatcher operational values (§12.5). Tunable, unlike the queue name, which is durable in Redis.
 *
 * No document states these — OQ-36 covers poll intervals for order state, export jobs and the
 * unread count, not this — so they are recorded rather than left as whatever the first
 * implementation happened to use.
 */

/**
 * One second. The user-visible flow that depends on it is verification and invitation email
 * (FR-9, FR-11): someone is sitting and waiting, and a poll interval is dead time before the job is
 * even enqueued. At this scale an empty query against a partial index costs nothing.
 */
export const DISPATCH_INTERVAL_MS = 1_000;

/** Claimed per poll under `FOR UPDATE SKIP LOCKED`, so several dispatchers never contend. */
export const DISPATCH_BATCH_SIZE = 100;

/**
 * After this many failures a row stops being retried and becomes a tracked exception with an owner
 * (NFR-71) rather than a silent retry loop burning the queue. The alternative — retrying forever —
 * turns one poisonous row into a permanent backlog that hides every healthy one behind it.
 */
export const MAX_DISPATCH_ATTEMPTS = 10;
