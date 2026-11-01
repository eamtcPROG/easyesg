/**
 * How the tenant application orders a text a person reads — an entity's name above all — wherever it sorts rather than
 * keeping the api's order: a list sorted by a column the reader chose, a filter's options (`architecture.md` OQ-61).
 *
 * **The root locale's collation, `und`**, the browser's and the server tier's counterpart of the api's `und-x-icu`
 * (`apps/api`'s `collation.ts`), and for OQ-61's reasons: case is ignored at the first difference and a comma-below
 * letter sorts beside its base letter rather than after `z`, which all three locales want, and the order is the same
 * whoever reads it — a `localeCompare` with no locale takes the runtime's, which is no one's decision. **Comparing
 * constructs nothing**, so it is no formatter and stays outside `i18n/formats.ts` (`reports.ts` recorded that case).
 */
const ROOT_LOCALE = 'und';

export const compareText = (left: string, right: string): number => left.localeCompare(right, ROOT_LOCALE);
