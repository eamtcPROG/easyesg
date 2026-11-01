import type { ConsoleCategory, NotificationCategoryKey } from '@easyesg/contracts';
import { DataTable } from '@easyesg/ui';
import { useTranslations } from 'use-intl';
import type { CategoryAction } from '../../../tools/category-action-state';
import { useCategoryColumns } from './category-columns';

/** Hoisted, so the table receives the same function every render. */
const rowKey = (row: ConsoleCategory): string => row.categoryKey;

/**
 * A-17's categories (task 67.10). **A table, not an Index**: the categories are read whole, with nothing to page, search
 * or filter — and never empty, since every category the release raises is answered whether anything is in force or not.
 *
 * **It says how many rows it holds, beneath the table** (task 170; `design_spec.md` §5.2's preamble): a list the api
 * answers whole has no pager to state its position, so the count is the line that tells an operator the table is all
 * there is.
 */
export function CategoryList({
  categories,
  busy,
  onOpen,
  onPreview,
}: {
  readonly categories: readonly ConsoleCategory[];
  readonly busy: boolean;
  readonly onOpen: (category: NotificationCategoryKey) => void;
  readonly onPreview: (action: CategoryAction) => void;
}) {
  const t = useTranslations('platform.notificationCategories.table');
  const columns = useCategoryColumns({ busy, onOpen, onPreview });

  return (
    <div className="flex min-w-0 flex-col gap-[var(--space-2)]">
      <DataTable caption={t('caption')} columns={columns} rows={categories} rowKey={rowKey} />
      <p className="t-caption text-[var(--text-muted)]">{t('count', { count: categories.length })}</p>
    </div>
  );
}
