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
 * would have to be flipped per locale.
 */
export const COLUMN_ALIGN = { START: 'start', END: 'end' } as const;

export type ColumnAlign = (typeof COLUMN_ALIGN)[keyof typeof COLUMN_ALIGN];

export type SortDirection = (typeof SORT_DIRECTION)[keyof typeof SORT_DIRECTION];
