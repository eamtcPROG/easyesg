import type { NotificationCategoryKey } from '@api/contracts/notification.port';

/**
 * The catalogue key a category's name resolves by — `notification.<category>.name` (task 50.2.1; §12.5.6's task-50.2
 * row (3)). **One spelling for the readers that name a category alone** — S-27's preferences and S-38's unsubscribe,
 * which each wrote it out until task 52's close review counted them. S-26's centre builds the category's prefix once
 * for its four in-app keys, and names it from that prefix beside them.
 */
export const categoryNameKey = (categoryKey: NotificationCategoryKey): string => `notification.${categoryKey}.name`;
