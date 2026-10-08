import type { NotificationCategoryBehaviour } from '../models/notification-category.model';

/**
 * Whether two behaviours are one (task 67.10) — the classification, and the channels **as a set**: their order is the
 * artefact's spelling, not a change, so republishing `[email, in_app]` over `[in_app, email]` is refused as unchanged.
 * **And the cadence** (task 51.2): a publication that only moves a repeat interval or a lead time is a change, which the
 * comparison of channels and classification alone would have refused as none.
 */
export const sameBehaviour = (a: NotificationCategoryBehaviour, b: NotificationCategoryBehaviour): boolean =>
  a.classification === b.classification &&
  sameSet(a.channels, b.channels) &&
  a.repeatIntervalDays === b.repeatIntervalDays &&
  sameSet(a.leadTimesDays ?? [], b.leadTimesDays ?? []) &&
  (a.leadTimesDays === undefined) === (b.leadTimesDays === undefined);

/** Two lists as sets — each member in the other — which is how channels and lead times are both compared. */
const sameSet = <T>(a: readonly T[], b: readonly T[]): boolean =>
  a.every((member) => b.includes(member)) && b.every((member) => a.includes(member));
