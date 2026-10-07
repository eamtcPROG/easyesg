/**
 * A list's free-text search, as a route narrows what it received (task 67.3's rule, shared since task 203.2 when S-16
 * became its second reader).
 *
 * **Its own query parameter, never a facet of the compact grammar**: a name may contain the grammar's `,` and `|`,
 * which would split one search into facets nobody typed. **Trimmed, cut rather than refused, and blank means none** —
 * an unreadable value falls back, as every other list parameter does, so a hand-edited address shows the list rather
 * than a 400 about the address. The query string can repeat a parameter, which arrives as an array; that is no search.
 */
export const narrowSearchTerm = (input: { readonly raw: unknown; readonly maxLength: number }): string | null => {
  const typed = typeof input.raw === 'string' ? input.raw.trim().slice(0, input.maxLength).trim() : '';
  return typed === '' ? null : typed;
};
