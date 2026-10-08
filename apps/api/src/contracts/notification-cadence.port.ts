import type { NotificationCategoryKey } from './notification.port';

/**
 * The cadence a category's notice keeps, read from its behaviour in force (task 51.2; FR-173) — **for the producers
 * that keep one**, FR-164's and FR-165's, and the writes that cancel their notices.
 *
 * **A port of its own rather than the catalogue's whole read**: a producer needs a number of days, not the channels a
 * notice travels on, which are the notification module's business at dispatch. And **`null` where nothing can be
 * read** — the artefact absent or malformed, or a category that keeps no such cadence — so a producer meets a cadence it
 * cannot keep as one it does not raise on, said once at `error` by the catalogue, rather than as a default it invented.
 */
export interface NotificationCadences {
  /** The days between raises of a notice whose condition still holds (FR-164). */
  repeatIntervalDays(query: { readonly categoryKey: NotificationCategoryKey }): number | null;
  /** The days before a due date at which a notice is raised, each its own notice, longest first (FR-165). */
  leadTimesDays(query: { readonly categoryKey: NotificationCategoryKey }): readonly number[] | null;
}

/** DI token beside the interface, as every port in `contracts/` is (P-7). */
export const NOTIFICATION_CADENCES = Symbol('NOTIFICATION_CADENCES');
