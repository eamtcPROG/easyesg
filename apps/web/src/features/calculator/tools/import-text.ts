/**
 * Text as the spreadsheet import compares it (task 204.2; FR-211): a column's name against the words a field is known
 * by, a cell against a source's, unit's or site's name — case, accents and punctuation set aside, because a sheet
 * that says `GAZ NATURAL`, `Gaz natural` or `gaz_natural` means one thing.
 *
 * Compatibility decomposition (NFKD) splits a letter from its accent, so `ș`, `ț`, `ă`, `î` and `â` read as their
 * base letters once the marks go, and folds `³` to `3`, so `m³` reads as `m3`. Every run of anything that is neither a
 * letter nor a digit becomes one space, which is what lets a match be made on whole words.
 */
export const matchText = (text: string): string =>
  text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/** A catalogue's comma-separated list of the words a column is known by, each as `matchText` reads it. */
export const wordsOf = (list: string): string[] =>
  list
    .split(',')
    .map(matchText)
    .filter((word) => word !== '');

/** Whether `phrase` appears in `text` as whole words — `unitate` in `unitate de masura`, never `unit` in `unitate`. */
export const holdsWords = (input: { readonly text: string; readonly phrase: string }): boolean =>
  ` ${input.text} `.includes(` ${input.phrase} `);
