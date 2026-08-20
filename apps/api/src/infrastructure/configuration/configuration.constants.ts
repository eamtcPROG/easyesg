/**
 * Configuration-store operational values (§12.5).
 *
 * AD-4 fixes the poll as the **authority** and bounds it: "a cheap poll of a single-row version
 * table (<= 5 s) is the authority, and a Redis pub/sub message is only a latency optimisation".
 * Five seconds is a ceiling taken from the decision, not a number chosen here.
 */

/** AD-4's bound, taken at its limit: one query against a one-row table costs nothing. */
export const CONFIG_POLL_INTERVAL_MS = 5_000;
