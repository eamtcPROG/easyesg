import { IndexShell, type IndexShellProps } from '@easyesg/ui';
import { useMemo } from 'react';
import { useTranslations } from 'use-intl';
import { PAGE_SIZES } from '~/lib/pagination';

/**
 * `IndexShell` with the console's chrome already bound (task 67.3) — `apps/web/src/shared/index-view.tsx`'s
 * binding, for this app's catalogue.
 *
 * The shell needs the same strings on every Index screen — the sort control's name and its two
 * directions, the pager's region, its two ends, its position sentence and a numbered page's name — so
 * they live once in `chrome.index` and a screen passes only its rows, columns, caption and two empty
 * states.
 *
 * **Every console Index offers a page size** (task 170; `design_spec.md` §5.2's preamble): a screen
 * passes where the choice goes, and this binding adds the sizes and their label, so the offer cannot
 * differ from one list to the next.
 *
 * **In `shared/` on that folder's admission test**: both contexts need it — A-02 is platform, the
 * queues are billing — and it imports nothing from `features/`, which `admin-shared-is-a-leaf`
 * enforces.
 */
export function IndexView<TRow, TColumnKey extends string>({
  onPageSizeChange,
  ...props
}: Omit<IndexShellProps<TRow, TColumnKey>, 'labels' | 'sizes'> & {
  readonly onPageSizeChange: (pageSize: number) => void;
}) {
  const t = useTranslations('chrome.index');

  // Memoised because it is a fresh object every render otherwise, reaching `DataTable` and
  // `Pagination` as a prop — and `reactCompiler` is off (AD-9), so nothing collapses it on its own.
  const labels = useMemo(
    () => ({
      sort: {
        sortBy: (columnHeader: string) => t('sort.sortBy', { column: columnHeader }),
        ascending: t('sort.ascending'),
        descending: t('sort.descending'),
      },
      pagination: {
        region: t('pagination.region'),
        previous: t('pagination.previous'),
        next: t('pagination.next'),
        position: (of: { from: number; to: number; total: number }) => t('pagination.position', of),
        page: (page: number) => t('pagination.page', { page }),
      },
    }),
    [t],
  );

  const sizes = useMemo(
    () => ({ options: PAGE_SIZES, onChange: onPageSizeChange, label: t('pagination.pageSize') }),
    [onPageSizeChange, t],
  );

  return <IndexShell {...props} sizes={sizes} labels={labels} />;
}
