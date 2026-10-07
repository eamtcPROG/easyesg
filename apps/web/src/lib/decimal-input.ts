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
 * **The answer is the canonical spelling, not the typed one** (task 204.2): no leading zero before a digit and no bare
 * point — `0500` is `500`, `12,` is `12`, `,5` is `0.5`. The api's own reading (`isDecimalString`) refuses the typed
 * spellings, and a refused calculator line holds FR-38's queue until something changes, so the reader of a figure is
 * where the spelling is settled — once, for every screen that reads one, and for an imported spreadsheet's cells.
 *
 * Empty is a legitimate answer here: it means *clear the field*, which the caller writes as a
 * `missing` state rather than as a value.
 */
export const parseDecimalInput = (raw: string): { readonly value: string | null } | { readonly invalid: true } => {
  const compact = raw.replace(/\s/gu, '');
  if (compact === '') return { value: null };
  const match = /^(-?)(\d*)(?:\.(\d*))?$/u.exec(compact.replace(',', '.'));
  const whole = match?.[2] ?? '';
  const fraction = match?.[3] ?? '';
  if (match === null || (whole === '' && fraction === '')) return { invalid: true };
  const digits = `${whole.replace(/^0+(?=\d)/u, '') || '0'}${fraction === '' ? '' : `.${fraction}`}`;
  // A zero has no sign: `-0` is the reader's zero, and the wire has one spelling of it.
  return { value: /[1-9]/u.test(digits) ? `${match[1]}${digits}` : digits };
};
