import { queryOptions } from '@tanstack/react-query';
import type {
  ApiOutcome,
  CategoryBehaviourRequest,
  CategoryPreview,
  CategoryPublication,
  CategoryPublicationRequest,
  CategoryReversionRequest,
  ConsoleCategory,
  NotificationCategoryKey,
} from '@easyesg/contracts';
import { api } from '~/realm/api/api-client';
import { CATEGORY_CONTROL, type CategoryAction } from '../tools/category-action-state';

/**
 * A-17's read, its preview and its two writes (task 67.10), through the realm's one client. The outcome is the answer,
 * not a thrown error — A-02's reason: a 403 is a state the section draws. **No poll** (UX-116): a write invalidates the
 * key, and a publication against a revision a colleague has since replaced is refused by the api whatever this cache
 * holds.
 */
export const NOTIFICATION_CATEGORIES_QUERY_KEY = ['admin', 'notification-categories'] as const;

export const notificationCategoriesQuery = () =>
  queryOptions({
    queryKey: NOTIFICATION_CATEGORIES_QUERY_KEY,
    queryFn: () => api.list<ConsoleCategory>('/admin/notification-categories'),
  });

const categoryPath = (category: NotificationCategoryKey) =>
  `/admin/notification-categories/${encodeURIComponent(category)}`;

/** What the action would change for recipients — writes nothing, and the api refuses a behaviour code forbids. */
export const previewCategoryAction = (action: CategoryAction): Promise<ApiOutcome<CategoryPreview>> =>
  api.post<CategoryBehaviourRequest, CategoryPreview>(`${categoryPath(action.categoryKey)}/preview`, action.behaviour);

/** The write itself — each a configuration publication the api records in the system audit log. */
export function runCategoryAction(action: CategoryAction): Promise<ApiOutcome<CategoryPublication>> {
  switch (action.control) {
    case CATEGORY_CONTROL.PUBLISH:
      return api.post<CategoryPublicationRequest, CategoryPublication>(`${categoryPath(action.categoryKey)}/publication`, {
        ...action.behaviour,
        expectedRevision: action.expectedRevision,
      });
    case CATEGORY_CONTROL.REVERT:
      return api.post<CategoryReversionRequest, CategoryPublication>(`${categoryPath(action.categoryKey)}/reversion`, {
        expectedRevision: action.expectedRevision,
      });
  }
}
