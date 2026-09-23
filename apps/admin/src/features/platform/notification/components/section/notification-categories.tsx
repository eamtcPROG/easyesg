import type { NotificationCategoriesSearch } from '../../tools/notification-categories-search';
import { CategoriesSection } from '../categories/section/categories-section';

/**
 * A-17 — Notification categories and templates (task 67.10; UC-176; `design_spec.md` §5.2 A-17). **The shell composes
 * the screen's regions** (`shell-composes-only`): the categories with the chosen one's record, which reads its own data
 * and draws its own states.
 */
export function NotificationCategories({
  search,
  onSearchChange,
}: {
  readonly search: NotificationCategoriesSearch;
  readonly onSearchChange: (next: NotificationCategoriesSearch) => void;
}) {
  return (
    <div className="flex flex-col gap-[var(--space-7)] p-[var(--space-6)]">
      <CategoriesSection search={search} onSearchChange={onSearchChange} />
    </div>
  );
}
