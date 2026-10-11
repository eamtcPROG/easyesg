/**
 * The `presentation_precision` payload, read (task 39.2): `{ "places": { "<unit code>": <places> } }`, each places a
 * whole number from zero to `MAX_PLACES`. **A payload is read whole or not at all**: a map with one bad entry is not a
 * map of the good ones, because a unit quietly dropped is a unit every surface shows unrounded with no one deciding it.
 * The reader answers `null`; publication refuses the same payload (`configuration-kind-rules.ts`), so a bad one is
 * stopped where someone is present to correct it.
 *
 * **Since task 46 it may also say `"elements": { "<element key>": <places> }`** — the places of a figure the platform
 * computes with no unit, by its element (`architecture.md` §12.5.6's task-46 row (10)): B3's intensity, B8's turnover
 * rate, B9's accident rate, B10's pay gap and bargaining coverage. A percentage's places count decimals of the percent.
 * Absent, it is none; present, it is read whole like the units, and its own reader answers it, so the unit map's two
 * readers are untouched.
 */

/** More places than any figure a report prints needs; past it, a value is a typo rather than a decision. */
export const MAX_PLACES = 10;

const UNIT_CODE = /^[A-Za-z0-9]{1,16}$/;
const ELEMENT_KEY = /^[A-Z][A-Za-z0-9]{0,159}$/;

/** A map of whole places, each key of `pattern`, read whole — or `null`. */
function placesMap(value: unknown, pattern: RegExp): Readonly<Record<string, number>> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const read: Record<string, number> = {};
  for (const [key, places] of Object.entries(value)) {
    if (!pattern.test(key) || !Number.isInteger(places) || (places as number) < 0 || (places as number) > MAX_PLACES) return null;
    read[key] = places as number;
  }
  return read;
}

export function readPresentationPrecision(payload: unknown): Readonly<Record<string, number>> | null {
  if (typeof payload !== 'object' || payload === null) return null;
  return placesMap((payload as { places?: unknown }).places, UNIT_CODE);
}

/** The places by element of a figure computed with no unit — `{}` where the payload names none, `null` where it is bad. */
export function readElementPrecision(payload: unknown): Readonly<Record<string, number>> | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const elements = (payload as { elements?: unknown }).elements;
  return elements === undefined ? {} : placesMap(elements, ELEMENT_KEY);
}

/** Why a payload may not be published, or `null` — the readers' own verdict, so publication and reading agree. */
export const presentationPrecisionRefusal = (payload: unknown): string | null =>
  readPresentationPrecision(payload) === null || readElementPrecision(payload) === null
    ? `a presentation precision is { "places": { "<unit>": <whole number 0 … ${MAX_PLACES}> }, "elements"?: { "<element>": <whole number 0 … ${MAX_PLACES}> } }, read whole`
    : null;
