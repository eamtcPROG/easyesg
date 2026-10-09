import {
  COLUMN_OF_KIND,
  DISCLOSURE_KIND,
  DISCLOSURE_STATE,
  VALUE_COLUMN,
  membersOf,
  type DisclosureField,
} from '@easyesg/contracts';

/**
 * What a hidden field still holds, as UX-28's notice states it — *"Kept: …"* (task 95; the C9 artboard's
 * *"Kept from 4 April: …"*, less the date, which the step read does not carry).
 *
 * **A description, not a sentence**: which shape the answer is, and its parts, so the notice words it with the reader's
 * formatter and catalogue, and every shape is a unit case here. `null` where nothing can be said that is not an
 * identifier — a choice whose members the catalogue names none of — and the notice then says the answer is kept without
 * quoting it.
 */
export const KEPT_ANSWER = {
  NOT_AVAILABLE: 'not_available',
  NUMBER: 'number',
  AMOUNT: 'amount',
  BOOLEAN: 'boolean',
  DATE: 'date',
  CHOICES: 'choices',
  TEXT: 'text',
} as const;

export type KeptAnswer =
  | { readonly kind: typeof KEPT_ANSWER.NOT_AVAILABLE }
  /**
   * A quantity, with the unit code it was answered in where it carries one. **A percent is one of these**, written as
   * stored with no sign added: the step shows a percent element's figure as stored (B8's turnover rate reads `0,125`),
   * and a notice that added `%` would quote the kept answer differently from the field it stood in for.
   */
  | { readonly kind: typeof KEPT_ANSWER.NUMBER; readonly value: string; readonly unitCode: string | null }
  /** Money, in the filing's currency — the code itself, as a monetary field shows it (task 36.12). */
  | { readonly kind: typeof KEPT_ANSWER.AMOUNT; readonly value: string; readonly currency: string | null }
  | { readonly kind: typeof KEPT_ANSWER.BOOLEAN; readonly value: boolean }
  /** A calendar date as stored, `YYYY-MM-DD` — a legal date the caller formats in UTC (`lib/legal-date.ts`). */
  | { readonly kind: typeof KEPT_ANSWER.DATE; readonly value: string }
  | { readonly kind: typeof KEPT_ANSWER.CHOICES; readonly labels: readonly string[] }
  | { readonly kind: typeof KEPT_ANSWER.TEXT; readonly value: string };

export function keptAnswerOf(field: DisclosureField): KeptAnswer | null {
  if (field.state === DISCLOSURE_STATE.NOT_AVAILABLE) return { kind: KEPT_ANSWER.NOT_AVAILABLE };
  switch (COLUMN_OF_KIND[field.kind]) {
    case VALUE_COLUMN.NUMERIC:
      if (field.valueNumeric === null) return null;
      if (field.kind === DISCLOSURE_KIND.MONETARY) {
        return { kind: KEPT_ANSWER.AMOUNT, value: field.valueNumeric, currency: field.currency };
      }
      return { kind: KEPT_ANSWER.NUMBER, value: field.valueNumeric, unitCode: field.unitCode };
    case VALUE_COLUMN.BOOLEAN:
      return field.valueBoolean === null ? null : { kind: KEPT_ANSWER.BOOLEAN, value: field.valueBoolean };
    case VALUE_COLUMN.DATE:
      return field.valueDate === null ? null : { kind: KEPT_ANSWER.DATE, value: field.valueDate };
    case VALUE_COLUMN.TEXT:
      return textOf(field);
  }
}

/**
 * A text column: a choice is named by its members' labels and never by the qualified name it stores (an XBRL name is an
 * internal identifier); anything else is the reporter's own words.
 */
function textOf(field: DisclosureField): KeptAnswer | null {
  if (field.valueText === null || field.valueText.trim() === '') return null;
  if (field.kind !== DISCLOSURE_KIND.ENUMERATION && field.kind !== DISCLOSURE_KIND.ENUMERATION_SET) {
    return { kind: KEPT_ANSWER.TEXT, value: field.valueText };
  }
  const named = new Map((field.options ?? []).map((option) => [option.value, option.label]));
  const labels = membersOf(field.valueText)
    .map((member) => named.get(member) ?? null)
    .filter((label): label is string => label !== null);
  return labels.length === 0 ? null : { kind: KEPT_ANSWER.CHOICES, labels };
}
