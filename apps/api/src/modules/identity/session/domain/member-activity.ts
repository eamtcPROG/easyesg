/**
 * FR-56's *last activity*, at a five-minute grain (project owner, 28 Sep 2026; `architecture.md` §12.5.6's
 * last-activity row).
 *
 * **Every authenticated request in an organization is activity there**, so `AuthGuard` records it once it has
 * resolved the membership the request acts through — but only where what is recorded is older than the grain.
 * Nearly every request then writes nothing, and the value is right to within five minutes — finer than S-16,
 * which shows the day.
 *
 * **Pure**, like `session-expiry.ts` beside it: the policy lives next to its citation and the adapter applies
 * the instant it is handed, rather than carrying the interval inside a query.
 */
export const ACTIVITY_GRAIN_MS = 5 * 60 * 1000;

/** The instant at or after which a recorded activity is recent enough to leave as it is. */
export const activityRecordedSince = (now: Date): Date => new Date(now.getTime() - ACTIVITY_GRAIN_MS);
