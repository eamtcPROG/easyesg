/**
 * Matching a catalogue string that may have been padded (task 30.2).
 *
 * The `expansion` project runs against the instance with `EASYESG_PSEUDOLOCALE=1`, where
 * `expandString` **appends** `·` until every string is 40% longer. Playwright's default substring
 * matching survives that; `{ exact: true }` does not, and dropping the exactness to compensate is
 * the wrong repair — `exact` is usually there because two labels share a prefix, which is
 * precisely what padding cannot fix and what a loose locator would hide.
 *
 * So this keeps the anchor at both ends and admits only the padding between the string's end and
 * the string's end: `^Parolă·*$` matches `Parolă` and `Parolă···`, and still refuses
 * `Parolă nouă`.
 */
const ESCAPE = /[.*+?^${}()|[\]\\]/g;

export const exactlyPadded = (text: string): RegExp =>
  new RegExp(`^${text.replace(ESCAPE, '\\$&')}·*$`);
