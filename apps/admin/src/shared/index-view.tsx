import { IndexShell, type IndexShellProps } from '@easyesg/ui';
import { useMemo } from 'react';
import { useTranslations } from 'use-intl';

/**
 * `IndexShell` with the console's chrome already bound (task 67.3) — `apps/web/src/shared/index-view.tsx`'s
 * binding, for this app's catalogue.
 *
 * The shell needs seven strings — the sort control's name and its two directions, the pager's region,
 * its two ends and its position sentence — and they are the same on every Index screen. The console
 * has five of them to come (A-02 now; A-10, A-11, A-13 and A-14 are Index queues), so they live once
 * in `chrome.index` and a screen passes only its rows, columns, caption and two empty states.
 *
 * **In `shared/` on that folder's admission test**: both contexts need it — A-02 is platform, the
 * queues are billing — and it imports nothing from `features/`, which `admin-shared-is-a-leaf`
 * enforces.
 */
export function IndexView<TRow, TColumnKey extends string>(
  props: Omit<IndexShellProps<TRow, TColumnKey>, 'labels'>,
) {
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
      },
    }),
    [t],
  );

  return <IndexShell {...props} labels={labels} />;
}
