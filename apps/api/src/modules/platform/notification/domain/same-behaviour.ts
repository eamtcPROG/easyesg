import type { NotificationCategoryBehaviour } from '../models/notification-category.model';

/**
 * Whether two behaviours are one (task 67.10) — the classification, and the channels **as a set**: their order is the
 * artefact's spelling, not a change, so republishing `[email, in_app]` over `[in_app, email]` is refused as unchanged.
 */
export const sameBehaviour = (a: NotificationCategoryBehaviour, b: NotificationCategoryBehaviour): boolean =>
  a.classification === b.classification &&
  a.channels.every((channel) => b.channels.includes(channel)) &&
  b.channels.every((channel) => a.channels.includes(channel));
