import type { useFormatter } from 'next-intl';

/**
 * A figure as a reader is shown it (task 39.2; NFR-18, NFR-26; `architecture.md` §12.5.6's task-182 row (3) and
 * task-39 row (5)).
 *
 * - **A computed figure is rounded once, half-up, to the places the configuration gives its unit** — exactly, in
 *   decimal (`roundHalfUp`), before it ever becomes a number, so `0.125` to two places is `0.13` and never the `0.12` a
 *   binary `0.125` might give. The rounded figure then goes to the locale's formatter with that many places, which only
 *   lays it out (`0,97` in Romanian, `0.97` in English) and has nothing left to round. **The places are configuration,
 *   not a named format**, which is the one inline option here: `presentation_precision` decides them per unit, and a
 *   named format in `i18n/formats.ts` would be a second, hard-coded copy of that decision.
 * - **A unit the configuration gives no places, and a published figure, keep every digit** — the named `exact` format.
 *
 * Assumed, and stated: a rounded figure of up to fifteen significant digits, which a double carries exactly. An SME's
 * tonnes to two places is eight or nine.
 *
 * **In `lib/` since task 39.3**, when S-07's computed and derived figures became its second reader beside S-09's
 * (§12.5.6's task-39 row (7)) — two features, one rounding, which is the whole of 182/3's *one rule binds all four*.
 */
type Formatter = Pick<ReturnType<typeof useFormatter>, 'number'>;

const DECIMAL = /^(\d+)(?:\.(\d+))?$/u;

/** A non-negative decimal string rounded half-up to `places`, exactly — `'0.125'`, 2 → `'0.13'`. */
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

export function formatFigure(input: {
  readonly value: string;
  /** Places to round to, or `undefined` for every digit. */
  readonly places: number | undefined;
  readonly format: Formatter;
}): string {
  if (!DECIMAL.test(input.value)) return input.value;
  if (input.places === undefined) return input.format.number(Number(input.value), 'exact');
  return input.format.number(Number(roundHalfUp(input.value, input.places)), {
    minimumFractionDigits: input.places,
    maximumFractionDigits: input.places,
  });
}
