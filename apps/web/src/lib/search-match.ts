/**
 * Whether a row answers a list's text search (task 203.2) — for the two lists that hold every row in the browser and
 * page there, S-06 and S-13. S-16 pages on the api, which matches the same way (`ILIKE '%term%'`), so a term finds the
 * same rows on all three: **anywhere in a field, ignoring case**. Diacritics are not folded, on either side.
 *
 * An empty term matches everything, so an unsearched list is the same expression as a searched one.
 */
export const matchesSearch = (input: {
  readonly term: string;
  readonly fields: readonly (string | number | null)[];
}): boolean => {
  if (input.term === '') return true;
  const term = input.term.toLocaleLowerCase();
  return input.fields.some((field) => field !== null && String(field).toLocaleLowerCase().includes(term));
};
