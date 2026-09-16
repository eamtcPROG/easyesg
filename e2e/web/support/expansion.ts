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
 * the string's end: `^Parolă·+$` matches `Parolă···` and still refuses `Parolă nouă`.
 *
 * **`·+`, not `·*` — one character, and it is the difference between this suite measuring the
 * padded catalogue and measuring ordinary Romanian** (7 Sep 2026, found by review on task 32.4).
 * `expandString` appends `PAD` until a string is 40% longer and returns early only when
 * `value.length >= ceil(value.length * 1.4)`, which no non-empty string satisfies — so **every**
 * string this project renders carries at least one `·`, and admitting zero admitted the one state
 * that means the harness did not run. It was not theoretical: `reuseExistingServer` was on outside
 * CI until task 102, so a stale unpadded server on port 3101 made every frame green while proving
 * nothing. The suite now stops the dev servers and starts every server itself, and the guard
 * stays — it is what proves the padded catalogue arrived, whatever answered.
 * `expansion.spec.ts` states the premise in its own words — *"the padded catalogue actually
 * arrived — otherwise this asserts nothing"* — and this makes it true of every caller rather than
 * of the four suites that remembered to assert it separately.
 */
const ESCAPE = /[.*+?^${}()|[\]\\]/g;

export const exactlyPadded = (text: string): RegExp =>
  new RegExp(`^${text.replace(ESCAPE, '\\$&')}·+$`);
