import type { NotificationCategoryKey } from '@api/contracts/notification.port';
import type { NotificationCategoryBehaviour } from '../models/notification-category.model';

/**
 * A category's behaviour in force — `NotificationCategoryCatalog`'s shape, named so no framework class enters a use
 * case (task 52.1), as `NotificationChannelDecision` names `CategoryChannels`'. `null` where it cannot be read.
 */
export interface NotificationCategoryBehaviours {
  behaviourOf(query: { readonly categoryKey: NotificationCategoryKey }): NotificationCategoryBehaviour | null;
}
