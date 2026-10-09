/**
 * A figure rounded for a reader — FR-29's one rule, half-up, exactly, to the places the configuration gives its unit
 * (NFR-18; `architecture.md` §12.5.6's task-182 row (3)).
 *
 * **Here because two runtimes read it** (task 43; §12.5.6's task-43 row (d)): S-07 and S-09 round a computed figure in
 * `apps/web`, and the document the api renders rounds every figure the same way, so the screen and the PDF cannot
 * disagree about a number. It moved from `apps/web/src/lib/figure-format.ts`, which keeps the locale's layout.
 *
 * **Arithmetic, not formatting** — this package's charter (§10.7) leaves the locale's separators and patterns to each
 * application's own formatter, and this touches none of them: it answers a decimal string, which a formatter then lays
 * out with that many places.
 */
const DECIMAL = /^(\d+)(?:\.(\d+))?$/u;

/**
 * A non-negative decimal string rounded half-up to `places`, exactly — `'0.125'`, 2 → `'0.13'` — never through a float,
 * where `0.125` is not what it looks like. A figure with no more places than asked, and anything that is not such a
 * decimal, is answered as it was.
 */
export function roundHalfUp(value: string, places: number): string {
  const match = DECIMAL.exec(value);
  if (match === null) return value;
  const [, whole, fraction = ''] = match;
  if (fraction.length <= places) return value;
  const kept = BigInt(whole + fraction.slice(0, places));
  const rounded = Number(fraction[places]) >= 5 ? kept + 1n : kept;
  const digits = rounded.toString().padStart(places + 1, '0');
  return places === 0 ? digits : `${digits.slice(0, -places)}.${digits.slice(-places)}`;
}
