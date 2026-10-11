'use client';

import type { Export } from '@easyesg/contracts';
import { BUTTON_VARIANT, Button, EmptyState, toPageSize, type IndexPage } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useCallback, useId, useTransition } from 'react';
import { useRouter } from '@/i18n/navigation';
import { reportExportRoute } from '@/lib/routes';
import { IndexView } from '@/shared/index-view';
import {
  EXPORTS_COLUMN,
  EXPORTS_FILTER_ANY,
  exportsViewQuery,
  type ExportsColumnKey,
  type ExportsView,
} from '../../tools/exports-view';
import { EXPORTS_MESSAGES } from '../shared/exports-messages';
import styles from '../styles/exports.module.css';
import { HistoryFilters } from './history-filters';
import { useHistoryColumns } from './history-columns';

/**
 * S-11's history (task 47.1's read, drawn by 47.3; UC-44, UX-49) — the Index archetype: its filters, its one ordering,
 * its two empty states and a download per completed row. **The view is the address** (UX-4): a filter, the order, a
 * page or a page size is a navigation, so Back undoes it and the Server Component reads the page it names.
 */
export function ExportHistory({
  reportId,
  page,
  view,
}: {
  readonly reportId: string;
  readonly page: IndexPage<Export>;
  readonly view: ExportsView;
}) {
  const t = useTranslations(EXPORTS_MESSAGES);
  const router = useRouter();
  const [, startNavigation] = useTransition();
  const columns = useHistoryColumns();
  const titleId = useId();

  const setView = useCallback(
    (next: Partial<ExportsView>) => {
      // Any change but the page's resets it: page 3 of a list that just became one page long reads as *no matches*.
      const query = exportsViewQuery({ ...view, ...next, ...(next.page === undefined ? { page: 1 } : {}) });
      startNavigation(() => router.push(reportExportRoute({ reportId, query }), { scroll: false }));
    },
    [reportId, router, view],
  );
  const clearFilters = useCallback(() => setView({ format: EXPORTS_FILTER_ANY, language: EXPORTS_FILTER_ANY }), [setView]);

  return (
    <section className={styles.region} aria-labelledby={titleId}>
      <h2 id={titleId} className={`t-heading-3 ${styles.sectionTitle}`}>
        {t('history.title')}
      </h2>
      <p className={`t-body ${styles.note}`}>{t('history.note')}</p>
      <HistoryFilters view={view} onChange={setView} />
      <IndexView<Export, ExportsColumnKey>
        page={page}
        caption={t('history.caption')}
        columns={columns}
        rowKey={(row) => row.id}
        sort={{ column: EXPORTS_COLUMN.REQUESTED, direction: view.direction }}
        onSortChange={(sort) => setView({ direction: sort.direction })}
        onPageChange={(next) => setView({ page: next })}
        onPageSizeChange={(size) => setView({ pageSize: toPageSize(size) })}
        empty={{
          // The dialogue above is the first use's way on, so this one teaches and points nowhere else.
          firstUse: (
            <EmptyState title={t('history.empty.firstUse.title')} action={null}>
              {t('history.empty.firstUse.body')}
            </EmptyState>
          ),
          filtered: (
            <EmptyState
              title={t('history.empty.filtered.title')}
              action={
                <Button variant={BUTTON_VARIANT.SUBTLE} onClick={clearFilters}>
                  {t('history.empty.filtered.action')}
                </Button>
              }
            >
              {t('history.empty.filtered.body')}
            </EmptyState>
          ),
        }}
      />
    </section>
  );
}
