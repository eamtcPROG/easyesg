/**
 * Reads a decimal the way a Moldovan reader types one, and answers the canonical string the wire
 * carries (NFR-58: a decimal as a string, never a float).
 *
 * **In `lib/` since task 39.1**, when S-09's invoice figures became its second reader beside S-07's
 * numeric fields — two features, one reading of what a reader typed, so a figure accepted on one screen
 * is never refused on the other for its punctuation.
 *
 * Field-level UX with no business meaning, which is what may live in the form (root `CLAUDE.md`):
 * a space is the thousands separator §11 formats with, a comma is the decimal separator in `ro`
 * and `ru`, and either is accepted alongside the dot. What is refused is anything that is not a
 * number — two separators, letters, an empty sign — because the column is `numeric` and the
 * database would refuse it with a message no reader can act on.
 *
 * Empty is a legitimate answer here: it means *clear the field*, which the caller writes as a
 * `missing` state rather than as a value.
 */
export const parseDecimalInput = (raw: string): { readonly value: string | null } | { readonly invalid: true } => {
  const compact = raw.replace(/\s/gu, '');
  if (compact === '') return { value: null };
  const normalised = compact.replace(',', '.');
  return /^-?(\d+\.?\d*|\.\d+)$/u.test(normalised) ? { value: normalised } : { invalid: true };
};
