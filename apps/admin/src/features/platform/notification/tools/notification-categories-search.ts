import { isNotificationCategoryKey, type NotificationCategoryKey } from '@easyesg/contracts';

/**
 * A-17's addressable state (task 67.10; UX-4): the category whose record is open. **A value this screen does not
 * understand is dropped**, so a stale or hand-edited address shows the list rather than an error.
 */
export interface NotificationCategoriesSearch {
  readonly category?: NotificationCategoryKey;
}

export const readNotificationCategoriesSearch = (raw: Record<string, unknown>): NotificationCategoriesSearch =>
  isNotificationCategoryKey(raw.category) ? { category: raw.category } : {};

export const withCategory = (
  search: NotificationCategoriesSearch,
  category: NotificationCategoryKey | null,
): NotificationCategoriesSearch => readNotificationCategoriesSearch({ ...search, category: category ?? undefined });
