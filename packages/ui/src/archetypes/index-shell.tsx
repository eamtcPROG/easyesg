'use client';

import type { ReactNode } from 'react';
import { DataTable, type DataTableColumn, type DataTableProps, type DataTableSort } from '../data-display/data-table';
import { Pagination, type PaginationProps } from '../navigation/pagination';
import styles from './index-shell.module.css';

/**
 * Index archetype (§4.6), body half — *"find one among many"*: empty state, sortable table,
 * pagination. Filter and row action are the caller's, and the reason is below.
 *
 * **Eleven tenant screens are Index** (S-06, S-13, S-14, S-16, S-21, S-22, S-26, S-32 and three
 * more), plus four admin Exception queues. S-16 built the composition first and it was on its way
 * to being written eleven times — which is what an archetype is *for*: §13.5 declares "page
 * archetype templates" a deliverable, and `FocusShell` beside this file is the same idea for the
 * one-task screens.
 *
 * **What it owns is the choice, not the parts.** `DataTable`, `Pagination` and `EmptyState` are
 * already inventory components and compose fine by hand; what does not survive being written by
 * hand eleven times is the rule between them — *which* empty state, and on what evidence:
 *
 * > `total` is rows before the filter and `matched` is rows after it. **A zero in each means a
 * > different screen.** `total === 0` is first use: nobody has been added yet and the one action is
 * > to add someone. `matched === 0` over rows is a filter that found nothing, and the one action is
 * > to clear it. Collapsing them tells an administrator with nine colleagues that they are alone.
 *
 * That distinction is easy to get right once and easy to lose on the fourth screen, which is the
 * test for whether something belongs in an archetype rather than in a screen.
 *
 * **The filter is deliberately not here.** §4.6 lists it among the fixed elements, but a filter is
 * made of the screen's own facets over the screen's own vocabulary — S-16 filters by role and
 * standing, S-22 by document kind and period — so a filter slot would be a `ReactNode` this
 * component passes through untouched, which is what a caller's own markup already is. The row
 * action is absent for the same reason and one more: it is a column, and columns are the caller's.
 *
 * **No text and no router**, per the package rule: every string arrives in `labels` or inside the
 * empty states the caller builds.
 */
export interface IndexPage<TRow> {
  /** The rows of the page being shown — already filtered, sorted and sliced by the caller. */
  readonly rows: readonly TRow[];
  /** Rows surviving the filter. What the pager counts, and what "no matches" is measured against. */
  readonly matched: number;
  /** Rows before the filter. A zero here is first use — see the note above. */
  readonly total: number;
  /** 1-based. */
  readonly page: number;
  readonly pageSize: number;
}

export interface IndexShellProps<TRow, TColumnKey extends string> {
  readonly page: IndexPage<TRow>;
  readonly caption: ReactNode;
  readonly columns: readonly DataTableColumn<TRow, TColumnKey>[];
  readonly rowKey: (row: TRow) => string;
  readonly sort: DataTableSort<TColumnKey>;
  readonly onSortChange: (sort: DataTableSort<TColumnKey>) => void;
  readonly onPageChange: (page: number) => void;
  /**
   * Both, always. §4.6: an Index *"always has an empty state that teaches"* — and there are two of
   * them, so one required slot each is how the archetype's own rule reaches the type.
   *
   * Pass `EmptyState` elements: it already requires a title, a body and an action, so the three
   * parts are enforced there rather than checked twice.
   */
  readonly empty: {
    readonly firstUse: ReactNode;
    readonly filtered: ReactNode;
  };
  /**
   * Chrome, not screen copy — the same sentences on every Index. An app is expected to bind these
   * once from its own catalogue rather than at each call site; `apps/web/src/shared/index-view.tsx`
   * is that binding, and it is why a screen here passes eight props rather than fifteen.
   */
  readonly labels: {
    readonly sort: NonNullable<DataTableProps<TRow, TColumnKey>['sortLabels']>;
    readonly pagination: PaginationProps['labels'];
  };
}

export function IndexShell<TRow, TColumnKey extends string>({
  page,
  caption,
  columns,
  rowKey,
  sort,
  onSortChange,
  onPageChange,
  empty,
  labels,
}: IndexShellProps<TRow, TColumnKey>) {
  if (page.matched === 0) {
    return <>{page.total === 0 ? empty.firstUse : empty.filtered}</>;
  }

  return (
    <div className={styles.index}>
      <DataTable
        caption={caption}
        columns={columns}
        rows={page.rows}
        rowKey={rowKey}
        sort={sort}
        onSortChange={onSortChange}
        sortLabels={labels.sort}
      />
      {/* Renders nothing for a single page — the pager is here so that finding one among many stays
          possible, not so that every instance carries the control. */}
      <Pagination
        page={page.page}
        pageSize={page.pageSize}
        total={page.matched}
        onPageChange={onPageChange}
        labels={labels.pagination}
      />
    </div>
  );
}
