import type { DisclosureField } from '@easyesg/contracts';

/**
 * What one field of a module shows under a support-access grant (task 67.9) — the value the organization stored,
 * read-only, as a kind the view can format: a number (formatted in the reader's locale, NFR-26), words, a yes or a
 * no, or nothing stored.
 *
 * **An enumerated answer shows its option's label**, as the wizard does, and falls back to the stored value only
 * where the step read carries no label for it. **Units are not shown**: a unit's words are `apps/web`'s catalogue
 * copy (OQ-43), and restating them here would be a second catalogue for one screen — recorded in task 67.9's
 * build-log entry as the view's known limit.
 */
export const FIELD_DISPLAY = {
  NUMBER: 'number',
  WORDS: 'words',
  YES: 'yes',
  NO: 'no',
  NONE: 'none',
} as const;

export type FieldDisplay =
  | { readonly kind: typeof FIELD_DISPLAY.NUMBER; readonly value: number }
  | { readonly kind: typeof FIELD_DISPLAY.WORDS; readonly text: string }
  | { readonly kind: typeof FIELD_DISPLAY.YES }
  | { readonly kind: typeof FIELD_DISPLAY.NO }
  | { readonly kind: typeof FIELD_DISPLAY.NONE };

export const fieldDisplayOf = (
  field: Pick<DisclosureField, 'valueBoolean' | 'valueNumeric' | 'valueDate' | 'valueText' | 'options'>,
): FieldDisplay => {
  if (field.valueBoolean !== null) return { kind: field.valueBoolean ? FIELD_DISPLAY.YES : FIELD_DISPLAY.NO };
  if (field.valueNumeric !== null) {
    const value = Number(field.valueNumeric);
    return Number.isFinite(value)
      ? { kind: FIELD_DISPLAY.NUMBER, value }
      : { kind: FIELD_DISPLAY.WORDS, text: field.valueNumeric };
  }
  if (field.valueDate !== null) return { kind: FIELD_DISPLAY.WORDS, text: field.valueDate };
  if (field.valueText !== null) {
    const option = field.options?.find((candidate) => candidate.value === field.valueText);
    return { kind: FIELD_DISPLAY.WORDS, text: option?.label ?? field.valueText };
  }
  return { kind: FIELD_DISPLAY.NONE };
};
