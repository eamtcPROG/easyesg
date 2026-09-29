/**
 * The data table's closed vocabularies — sort direction and column alignment.
 *
 * **A vocabulary in a module with no `'use client'`, and that is the whole point of the file.**
 * `data-table.tsx` is a client module, so every export it carries becomes a client reference — an
 * `as const` object read from a Server Component is `undefined`, silently, on both sides of the
 * boundary. `primitives/button-vocabulary.ts` carries the full account and the defect that found
 * it. This one had no server reader yet; it would have failed the same way on the first.
 */
/** Which way a column is sorted. Ascending first, because that is what a click means by default. */
export const SORT_DIRECTION = { ASCENDING: 'asc', DESCENDING: 'desc' } as const;

/**
 * Which edge a column's content sits against — logical, not physical, because the product is
 * read in three languages and `start`/`end` follow the writing direction where `left`/`right`
 * would have to be flipped per locale. **`center`** (29 Sep 2026) is for a short value under a
 * wider header — a small count, a status chip — which sits symmetrically beneath it.
 */
export const COLUMN_ALIGN = { START: 'start', CENTER: 'center', END: 'end' } as const;

export type ColumnAlign = (typeof COLUMN_ALIGN)[keyof typeof COLUMN_ALIGN];

/**
 * How much of the table's width a column takes (29 Sep 2026). **`fill`** columns share what is
 * left equally, so two text columns stand at the same width however their content differs;
 * **`fit`** columns take their content's width and no more — a count, a chip, a row's action. A
 * column given neither is sized by the browser from its content, as every table was before, so a
 * table opts in column by column and one that does not is unchanged.
 */
export const COLUMN_SIZE = { FILL: 'fill', FIT: 'fit' } as const;

export type ColumnSize = (typeof COLUMN_SIZE)[keyof typeof COLUMN_SIZE];

export type SortDirection = (typeof SORT_DIRECTION)[keyof typeof SORT_DIRECTION];
