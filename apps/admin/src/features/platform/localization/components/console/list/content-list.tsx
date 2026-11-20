import type { ContentItem } from '@easyesg/contracts';
import { DataTable, EmptyState } from '@easyesg/ui';
import { useTranslations } from 'use-intl';
import { useContentColumns } from './content-columns';

/** Hoisted, so the table receives the same function every render. */
const rowKey = (item: ContentItem): string => `${item.kind}/${item.key}`;

/**
 * A-03's items (task 67.5) — every help topic, article and plan copy the store holds, published or drafted, read whole
 * with nothing to page. The count beneath says the table is all there is (task 170).
 */
export function ContentList({
  items,
  onOpen,
}: {
  readonly items: readonly ContentItem[];
  readonly onOpen: (item: ContentItem) => void;
}) {
  const t = useTranslations('platform.content.table');
  const columns = useContentColumns({ onOpen });

  if (items.length === 0) return (
      <EmptyState title={t('emptyTitle')} action={null}>
        {t('emptyBody')}
      </EmptyState>
    );
  return (
    <div className="flex min-w-0 flex-col gap-[var(--space-2)]">
      <DataTable caption={t('caption')} columns={columns} rows={items} rowKey={rowKey} />
      <p className="t-caption text-[var(--text-muted)]">{t('count', { count: items.length })}</p>
    </div>
  );
}
