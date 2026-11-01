import type { FindingField } from '@easyesg/contracts';

/** How a finding's field is told from its siblings under one label (task 42.2). */
export const FIELD_DETAIL = { MEMBER: 'member', ROW: 'row' } as const;

export type FieldDetail =
  | { readonly kind: typeof FIELD_DETAIL.MEMBER; readonly label: string }
  | { readonly kind: typeof FIELD_DETAIL.ROW; readonly position: number };

/**
 * **Which of a label's fields a finding sits on** (task 42.2; S-08): a field's label is its element's, so two findings
 * on B8's headcount by country, or on a second site's town, would read the same without this.
 *
 * - **A member the read named** — the catalogue's wording, in the reader's locale.
 * - **Else a country, by the browser's own names** (task 36.9): B8's members are ISO codes the read leaves unnamed, and
 *   this app words them, as the step's own options do.
 * - **Else a later row of a repeating group, by its position** — *Row 2*. The first row says nothing, being where a
 *   single-row field's one answer is too.
 *
 * `null` where there is nothing to tell apart. Never the member's key, which is an XBRL identifier.
 */
export function fieldDetail(input: {
  readonly field: Pick<FindingField, 'dimensionKey' | 'ordinal' | 'memberLabel'>;
  /** The country names this app words, by ISO code. */
  readonly countries: Readonly<Record<string, string>>;
}): FieldDetail | null {
  const { field } = input;
  if (field.memberLabel !== null) return { kind: FIELD_DETAIL.MEMBER, label: field.memberLabel };
  const country = field.dimensionKey === '' ? undefined : input.countries[field.dimensionKey];
  if (country !== undefined) return { kind: FIELD_DETAIL.MEMBER, label: country };
  return field.ordinal > 0 ? { kind: FIELD_DETAIL.ROW, position: field.ordinal + 1 } : null;
}
