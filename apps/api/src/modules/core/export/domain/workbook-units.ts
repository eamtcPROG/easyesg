/**
 * Units the template's cells offer, and the exact conversion between two of one kind (task 46; `architecture.md`
 * §12.5.6's task-46 row (6)).
 *
 * **Why a figure is ever converted**: the template has one unit cell for B4's three emission columns and one for B5's
 * land-use figures, while the platform keeps a unit per element (task 91.4); and B5's cells offer hectares or square
 * metres where the taxonomy admits hectares or square kilometres. So the figures a cell governs are written in one unit
 * the cell offers — **the largest it offers that is no larger than the finest among them**, so every conversion
 * multiplies by a power of ten and none rounds.
 *
 * The sizes are arithmetic, not the standard: a tonne is a thousand kilogrammes whatever EFRAG publishes next.
 */

/** Each unit's size in its kind's smallest unit, as a power of ten — kg and t are 10⁰ and 10³ of a kilogramme. */
const UNIT_SIZE: Readonly<Record<string, { readonly kind: string; readonly power: number }>> = {
  kg: { kind: 'mass', power: 0 },
  t: { kind: 'mass', power: 3 },
  m2: { kind: 'area', power: 0 },
  ha: { kind: 'area', power: 4 },
  sqkm: { kind: 'area', power: 6 },
  m3: { kind: 'volume', power: 0 },
};

/**
 * The unit a cell governing figures in `stored` units is written in, from the units it `offered` — or `null` where
 * none is of their kind, or the figures are not of one kind.
 */
export function placedUnit(input: { readonly stored: readonly string[]; readonly offered: readonly string[] }): string | null {
  const sizes = input.stored.map((unit) => UNIT_SIZE[unit]);
  if (sizes.length === 0 || sizes.some((size) => size === undefined)) return null;
  const kind = sizes[0].kind;
  if (sizes.some((size) => size.kind !== kind)) return null;
  // One unit, offered as it is, is written as it is — a stored tonne stays a tonne.
  const distinct = [...new Set(input.stored)];
  if (distinct.length === 1 && input.offered.includes(distinct[0])) return distinct[0];
  const finest = Math.min(...sizes.map((size) => size.power));
  const candidates = input.offered
    .map((unit) => ({ unit, size: UNIT_SIZE[unit] }))
    .filter(({ size }) => size !== undefined && size.kind === kind && size.power <= finest)
    .sort((a, b) => b.size.power - a.size.power);
  return candidates[0]?.unit ?? null;
}

/** Whether a unit is one this module can convert — the kinds the template's unit cells offer. */
export const isConvertible = (unit: string): boolean => UNIT_SIZE[unit] !== undefined;

/**
 * A decimal in `from` as the same quantity in `to`, exactly — the decimal point moved by the difference of their
 * powers of ten, never through a float. `to` is never larger than `from` here (`placedUnit`), so the result has no more
 * fractional digits than the input.
 */
export function convertFigure(input: { readonly value: string; readonly from: string; readonly to: string }): string {
  const from = UNIT_SIZE[input.from];
  const to = UNIT_SIZE[input.to];
  if (from === undefined || to === undefined || from.kind !== to.kind) {
    throw new Error(`${input.from} cannot be written as ${input.to}`);
  }
  return shift(input.value, from.power - to.power);
}

/** A decimal string times 10^places, for a whole `places` of either sign. */
function shift(value: string, places: number): string {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value);
  if (match === null) throw new Error(`${value} is not a decimal`);
  const [, sign, whole, fraction = ''] = match;
  const digits = whole + fraction;
  const point = whole.length + places;
  const padded = point > digits.length ? digits.padEnd(point, '0') : point < 0 ? '0'.repeat(-point) + digits : digits;
  const at = Math.max(point, 0);
  const integer = padded.slice(0, at).replace(/^0+(?=\d)/, '') || '0';
  const decimals = padded.slice(at).replace(/0+$/, '');
  return `${sign}${integer}${decimals === '' ? '' : `.${decimals}`}`;
}
