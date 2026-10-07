/**
 * The `presentation_precision` payload, read (task 39.2): `{ "places": { "<unit code>": <places> } }`, each places a
 * whole number from zero to `MAX_PLACES`. **A payload is read whole or not at all**: a map with one bad entry is not a
 * map of the good ones, because a unit quietly dropped is a unit every surface shows unrounded with no one deciding it.
 * The reader answers `null`; publication refuses the same payload (`configuration-kind-rules.ts`), so a bad one is
 * stopped where someone is present to correct it.
 */

/** More places than any figure a report prints needs; past it, a value is a typo rather than a decision. */
export const MAX_PLACES = 10;

const UNIT_CODE = /^[A-Za-z0-9]{1,16}$/;

export function readPresentationPrecision(payload: unknown): Readonly<Record<string, number>> | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const places = (payload as { places?: unknown }).places;
  if (typeof places !== 'object' || places === null || Array.isArray(places)) return null;
  const read: Record<string, number> = {};
  for (const [unit, value] of Object.entries(places)) {
    if (!UNIT_CODE.test(unit) || !Number.isInteger(value) || (value as number) < 0 || (value as number) > MAX_PLACES) {
      return null;
    }
    read[unit] = value as number;
  }
  return read;
}

/** Why a payload may not be published, or `null` — the reader's own verdict, so publication and reading agree. */
export const presentationPrecisionRefusal = (payload: unknown): string | null =>
  readPresentationPrecision(payload) === null
    ? `a presentation precision is { "places": { "<unit>": <whole number 0 … ${MAX_PLACES}> } }, read whole`
    : null;
