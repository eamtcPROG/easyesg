import type { ContentFallback } from '@easyesg/contracts';
import { isLocale } from '@easyesg/i18n';
import { COLUMN_ALIGN, DataTable, type DataTableColumn } from '@easyesg/ui';
import { useMemo } from 'react';
import { useFormatter, useTranslations } from 'use-intl';

const QUEUE_COLUMN = { ITEM: 'item', LOCALE: 'locale', COUNT: 'count', LAST: 'last' } as const;
type QueueColumn = (typeof QUEUE_COLUMN)[keyof typeof QUEUE_COLUMN];

const rowKey = (entry: ContentFallback): string => `${entry.contentKey}/${entry.locale}`;

/**
 * FR-64's queue on A-03 (task 67.5; UC-74; 182/38): each item read in a locale it lacks, how often and when last — the
 * reader was served Romanian. Most-read first, the order the api answers, so a translator starts where it matters most.
 * A row leaves on its own once a published translation exists.
 */
export function FallbackQueue({ entries }: { readonly entries: readonly ContentFallback[] }) {
  const t = useTranslations('platform.content.queue');
  const tLocales = useTranslations('platform.content.locales');
  const format = useFormatter();

  const columns = useMemo<readonly DataTableColumn<ContentFallback, QueueColumn>[]>(
    () => [
      { key: QUEUE_COLUMN.ITEM, header: t('item'), cell: (entry) => <span translate="no">{entry.contentKey}</span> },
      {
        key: QUEUE_COLUMN.LOCALE,
        header: t('locale'),
        cell: (entry) => (isLocale(entry.locale) ? tLocales(entry.locale) : entry.locale),
      },
      { key: QUEUE_COLUMN.COUNT, header: t('count'), align: COLUMN_ALIGN.END, cell: (entry) => format.number(entry.occurrences) },
      { key: QUEUE_COLUMN.LAST, header: t('last'), cell: (entry) => format.dateTime(entry.lastSeenAt, 'stamp') },
    ],
    [t, tLocales, format],
  );

  return (
    <section aria-labelledby="content-queue" className="flex flex-col gap-[var(--space-3)]">
      <h2 id="content-queue" className="t-heading-3">
        {t('title')}
      </h2>
      <p className="t-body text-[var(--text-muted)]">{t('lede')}</p>
      {entries.length === 0 ? (
        <p className="t-body">{t('empty')}</p>
      ) : (
        <DataTable caption={t('caption')} columns={columns} rows={entries} rowKey={rowKey} />
      )}
    </section>
  );
}
