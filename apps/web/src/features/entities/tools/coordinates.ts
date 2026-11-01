/**
 * A site's coordinates as a reader types them, and as the api stores them (task 180.1).
 *
 * **One field, typed as a map copies it** — *47.0105, 28.8638* — rather than two, because that is how a reader has them:
 * copied from a map in one piece. The api takes two decimal-degree strings, at most six decimal places each, both or
 * neither (`core.site`'s `site_coordinates_paired`), and this is the conversion between the two.
 *
 * **Strings throughout, never a float**: the api's own description says why — B5's biodiversity applicability is decided
 * from these (BR-APP-3), so a value drifting in its last places is a determination that changes. So the digits are kept
 * as typed and cut, not rounded, past the sixth place — about ten centimetres, which no map a reader copies from is
 * sure of.
 *
 * **What it admits**: two numbers, dot decimals, separated by a comma, a semicolon or a space — or comma decimals
 * separated by a semicolon or a space, which is how a Romanian or Russian locale writes them. Latitude within ±90,
 * longitude within ±180.
 */
export const COORDINATES = {
  /** Nothing typed — the site has no coordinates, which is an answer. */
  EMPTY: 'empty',
  VALID: 'valid',
  /** Something typed that is not a pair of coordinates. */
  INVALID: 'invalid',
} as const;

export type ParsedCoordinates =
  | { readonly kind: typeof COORDINATES.EMPTY }
  | { readonly kind: typeof COORDINATES.INVALID }
  | { readonly kind: typeof COORDINATES.VALID; readonly latitude: string; readonly longitude: string };

/** Dot decimals: `47.0105, 28.8638`, `47.0105;28.8638`, `47.0105 28.8638`. */
const DOT_DECIMALS = /^(-?\d{1,3}(?:\.\d+)?)\s*(?:[,;]\s*|\s+)(-?\d{1,3}(?:\.\d+)?)$/u;
/** Comma decimals, which a comma cannot also separate: `47,0105; 28,8638`, `47,0105 28,8638`. */
const COMMA_DECIMALS = /^(-?\d{1,3}(?:,\d+)?)\s*(?:;\s*|\s+)(-?\d{1,3}(?:,\d+)?)$/u;

const MAX_DECIMALS = 6;

/** One number as the api stores it: a dot, and no more than six decimal places. */
function degrees(typed: string): string {
  const [whole, fraction = ''] = typed.replace(',', '.').split('.');
  const kept = fraction.slice(0, MAX_DECIMALS).replace(/0+$/u, '');
  return kept === '' ? whole : `${whole}.${kept}`;
}

export function parseCoordinates(text: string): ParsedCoordinates {
  const typed = text.trim();
  if (typed === '') return { kind: COORDINATES.EMPTY };

  const match = DOT_DECIMALS.exec(typed) ?? COMMA_DECIMALS.exec(typed);
  if (match === null) return { kind: COORDINATES.INVALID };

  const latitude = degrees(match[1]);
  const longitude = degrees(match[2]);
  if (Math.abs(Number(latitude)) > 90 || Math.abs(Number(longitude)) > 180) return { kind: COORDINATES.INVALID };
  return { kind: COORDINATES.VALID, latitude, longitude };
}

/**
 * The field's text for a stored pair — *47.0105, 28.8638* — or empty where the site has none. **Without the column's
 * padding**: the api returns `numeric(9,6)` as stored, *47.089100*, and a reader who typed *47.0891* should see that.
 */
export function formatCoordinates(site: { readonly latitude: string | null; readonly longitude: string | null }): string {
  return site.latitude === null || site.longitude === null ? '' : `${degrees(site.latitude)}, ${degrees(site.longitude)}`;
}
