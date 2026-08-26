'use client';

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import type { ReactNode } from 'react';
import styles from './data-table.module.css';

/**
 * Data table — §11.5's Data display entry, and the body of the Index archetype.
 *
 * **Sortable here; filtering belongs to the screen, and that split is deliberate.** The inventory
 * entry reads "sortable, filterable, selectable", which describes the capability an Index needs
 * rather than three props on one component. Sorting is a property of *columns*, which only the
 * table knows about. Filtering is a property of the *query* — S-16 filters one union assembled from
 * two API collections, and a table that owned the predicate would have to be told how to read every
 * consumer's row shape. So the screen filters and hands over rows, which also keeps the filter
 * control reusable (it is an ordinary `TextField`) and the empty-filtered state where it belongs,
 * beside the thing that emptied it.
 *
 * **Selection is not built**, and that is a recorded absence rather than an oversight: S-16 has no
 * bulk action, and the first consumer that does is the admin Exception queue (§4.6), whose own
 * fixed elements include "bulk action" and "per-item resolution with mandatory rationale". Building
 * a checkbox column with nothing to submit it to would be a state set nobody has designed.
 *
 * **Row actions are a column the caller supplies.** The alternative — an `actions` prop rendering a
 * menu — would put the product's actions inside a presentational package, where they could carry no
 * translation and no router (the standing rule for this package).
 *
 * States (§8.1): the table renders *ready*. Every other state is a different component by design —
 * `EmptyState` for both empty states, `Callout` for the error states, a skeleton for *loading —
 * initial* — because a table that rendered its own empty state would need the caller's copy, and a
 * table that rendered its own error would need the caller's retry.
 */

/** Which way a column is sorted. Ascending first, because that is what a click means by default. */
export const SORT_DIRECTION = { ASCENDING: 'asc', DESCENDING: 'desc' } as const;

/**
 * Which edge a column's content sits against — logical, not physical, because the product is
 * read in three languages and `start`/`end` follow the writing direction where `left`/`right`
 * would have to be flipped per locale.
 */
export const COLUMN_ALIGN = { START: 'start', END: 'end' } as const;

export type ColumnAlign = (typeof COLUMN_ALIGN)[keyof typeof COLUMN_ALIGN];

export type SortDirection = (typeof SORT_DIRECTION)[keyof typeof SORT_DIRECTION];

export interface DataTableSort<TColumnKey extends string> {
  readonly column: TColumnKey;
  readonly direction: SortDirection;
}

export interface DataTableColumn<TRow, TColumnKey extends string> {
  readonly key: TColumnKey;
  /** The header, localized by the caller. */
  readonly header: ReactNode;
  readonly cell: (row: TRow) => ReactNode;
  /**
   * Omit for a column that cannot be ordered — a row-action column, or one whose values have no
   * order a reader would recognise. A header with no sort is a plain header, not a dead button.
   */
  readonly sortable?: boolean;
  /** End-align a numeric column so digits line up; `t-numeric` carries tabular figures. */
  readonly align?: ColumnAlign;
}

export interface DataTableProps<TRow, TColumnKey extends string> {
  readonly caption: ReactNode;
  readonly columns: readonly DataTableColumn<TRow, TColumnKey>[];
  readonly rows: readonly TRow[];
  readonly rowKey: (row: TRow) => string;
  /** Present together, or the table renders as unsorted and its headers as plain. */
  readonly sort?: DataTableSort<TColumnKey>;
  readonly onSortChange?: (sort: DataTableSort<TColumnKey>) => void;
  /** Accessible names for the sort control, localized by the caller. */
  readonly sortLabels?: {
    readonly sortBy: (column: string) => string;
    readonly ascending: string;
    readonly descending: string;
  };
}

export function DataTable<TRow, TColumnKey extends string>({
  caption,
  columns,
  rows,
  rowKey,
  sort,
  onSortChange,
  sortLabels,
}: DataTableProps<TRow, TColumnKey>) {
  const sortable = onSortChange !== undefined && sortLabels !== undefined;

  return (
    <div className={styles.scroller}>
      <table className={styles.table}>
        {/* A caption rather than an `aria-label`: it is the table's own name, it survives with the
            markup into a copy-paste or a print, and §11.6's roles style it like any other text. */}
        <caption className={`t-caption ${styles.caption}`}>{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={column.align === COLUMN_ALIGN.END ? styles.end : undefined}
                // The one attribute that makes a sortable table navigable: a screen reader
                // announces the current order on the header itself rather than leaving the reader
                // to infer it from an icon.
                aria-sort={ariaSort(sort, column.key)}
              >
                {sortable && column.sortable === true ? (
                  <button
                    type="button"
                    className={styles.sortButton}
                    onClick={() => onSortChange(nextSort(sort, column.key))}
                    aria-label={sortLabels.sortBy(String(column.key))}
                  >
                    {column.header}
                    <SortGlyph sort={sort} column={column.key} />
                  </button>
                ) : (
                  column.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={column.align === COLUMN_ALIGN.END ? styles.end : undefined}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The next sort a click produces: a new column starts ascending, the current one reverses.
 *
 * Exported because it is the rule rather than the rendering — a consumer holding sort in the URL
 * (UX-4 requires every addressable state to be there) applies it without re-deriving the toggle.
 */
export function nextSort<TColumnKey extends string>(
  current: DataTableSort<TColumnKey> | undefined,
  column: TColumnKey,
): DataTableSort<TColumnKey> {
  if (current?.column !== column) return { column, direction: SORT_DIRECTION.ASCENDING };
  return {
    column,
    direction:
      current.direction === SORT_DIRECTION.ASCENDING
        ? SORT_DIRECTION.DESCENDING
        : SORT_DIRECTION.ASCENDING,
  };
}

const ariaSort = <TColumnKey extends string>(
  sort: DataTableSort<TColumnKey> | undefined,
  column: TColumnKey,
): 'ascending' | 'descending' | 'none' | undefined => {
  if (sort?.column !== column) return undefined;
  return sort.direction === SORT_DIRECTION.ASCENDING ? 'ascending' : 'descending';
};

/** Decorative: `aria-sort` above is what carries the order to assistive technology (UX-102). */
function SortGlyph<TColumnKey extends string>({
  sort,
  column,
}: {
  sort: DataTableSort<TColumnKey> | undefined;
  column: TColumnKey;
}) {
  if (sort?.column !== column) {
    return <ArrowUpDown className={styles.sortGlyphIdle} aria-hidden="true" />;
  }
  const Glyph = sort.direction === SORT_DIRECTION.ASCENDING ? ArrowUp : ArrowDown;
  return <Glyph className={styles.sortGlyph} aria-hidden="true" />;
}
