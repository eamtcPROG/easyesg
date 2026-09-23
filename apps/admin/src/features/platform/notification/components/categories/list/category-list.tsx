import type { ConsoleCategory, NotificationCategoryKey } from '@easyesg/contracts';
import { DataTable } from '@easyesg/ui';
import { useTranslations } from 'use-intl';
import { useCategoryColumns } from './category-columns';

/** Hoisted, so the table receives the same function every render. */
const rowKey = (row: ConsoleCategory): string => row.categoryKey;

/**
 * A-17's categories (task 67.10). **A table, not an Index**: the categories are read whole, with nothing to page, search
 * or filter — and never empty, since every category the release raises is answered whether anything is in force or not.
 */
export function CategoryList({
  categories,
  onOpen,
}: {
  readonly categories: readonly ConsoleCategory[];
  readonly onOpen: (category: NotificationCategoryKey) => void;
}) {
  const t = useTranslations('platform.notificationCategories.table');
  const columns = useCategoryColumns({ onOpen });

  return <DataTable caption={t('caption')} columns={columns} rows={categories} rowKey={rowKey} />;
}
