/**
 * What each of the report's B1 site rows is called, as the wizard calls it (task 39.1; FR-33, UX-40).
 *
 * **The wizard's own name, read from its step, never a second naming rule.** S-07 names a site row by the report's own
 * answer for it — the first text element on the site axis with something in it, or the company's name for a site the
 * record gave (tasks 36.6, 180.3) — and serves it as each field's `dimensionLabel`. The calculator groups its lines by
 * the same rows, so a site reads the same on both screens; a rule restated here would be the second copy that drifts.
 *
 * **The axis is B1's address's**, `site-rows.ts`'s idiom, so a release that renamed the axis moves this with it. A row
 * no field names is absent from the answer, and the screen shows its position instead.
 */
export function siteNames(input: {
  /** The element whose first axis is the site axis — B1's address. */
  readonly addressElement: string;
  /** The B1 step's fields, in any order. */
  readonly fields: readonly {
    readonly elementKey: string;
    readonly axes: readonly string[];
    readonly ordinal: number;
    readonly dimensionLabel: string | null;
  }[];
}): ReadonlyMap<number, string> {
  const axis = input.fields.find((field) => field.elementKey === input.addressElement)?.axes[0];
  const names = new Map<number, string>();
  if (axis === undefined) return names;
  for (const field of input.fields) {
    if (!field.axes.includes(axis) || field.dimensionLabel === null || names.has(field.ordinal)) continue;
    names.set(field.ordinal, field.dimensionLabel);
  }
  return names;
}
