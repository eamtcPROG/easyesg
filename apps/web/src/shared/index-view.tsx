'use client';

import { IndexShell, type IndexShellProps } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';

/**
 * `IndexShell` with this app's chrome already bound (26 Aug 2026).
 *
 * **This is the half that makes the archetype cheap to use.** The shell needs seven strings — the
 * sort control's accessible name and its two directions, the pager's region, its two ends and its
 * position sentence — and they are identical on every Index screen. Written at each call site they
 * would be seven message keys duplicated into eleven namespaces, and eleven chances for one screen
 * to say "Pagina următoare" while another says "Înainte".
 *
 * They live in `chrome.index` and are read here once. What a screen passes is only what is
 * genuinely its own: its rows, its columns, its caption and its two empty states.
 *
 * `packages/ui` cannot do this itself — it holds no text, by the standing rule that keeps a
 * re-skin to tier 1 and keeps the package loadable by the PDF worker. So the binding lives here,
 * in `shared/`, which is where chrome owned by no single feature goes.
 */
export function IndexView<TRow, TColumnKey extends string>(
  props: Omit<IndexShellProps<TRow, TColumnKey>, 'labels'>,
) {
  const t = useTranslations('chrome.index');

  // Memoised because it is a fresh object every render otherwise, and it reaches `DataTable` and
  // `Pagination` as a prop. `reactCompiler` is off with a recorded reason (AD-9), so nothing
  // collapses this on its own.
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
        position: (of: { from: number; to: number; total: number }) =>
          t('pagination.position', of),
      },
    }),
    [t],
  );

  return <IndexShell {...props} labels={labels} />;
}
