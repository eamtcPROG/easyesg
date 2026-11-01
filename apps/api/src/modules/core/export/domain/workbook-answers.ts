import { DISCLOSURE_KIND, MEMBER_SEPARATOR } from '@easyesg/vsme';
import { DISCLOSURE_STATE } from '@api/modules/core/disclosure/models/disclosure-value.model';
import type { DisclosureField } from '@api/modules/core/disclosure/models/wizard-step.model';
import type { WorkbookAnswer } from './workbook-value';

/** What a field holds, as the export reads it. */
export const FIELD_HOLDING = {
  /** Answers to write — one, or one per member of a set. */
  ANSWERS: 'answers',
  /** FR-32's declared gap, with its reason. */
  NOT_AVAILABLE: 'not_available',
  NOTHING: 'nothing',
} as const;

export type FieldHolding =
  | { readonly kind: typeof FIELD_HOLDING.ANSWERS; readonly answers: readonly WorkbookAnswer[] }
  | { readonly kind: typeof FIELD_HOLDING.NOT_AVAILABLE; readonly reason: string | null }
  | { readonly kind: typeof FIELD_HOLDING.NOTHING };

/**
 * The answers a field holds for the Excel export — **what a validation run reads, stored answers only** (task 43's
 * rule, row (c)), so a default the reporter never saved is not filed. FR-30's nil return is a stated zero (FR-50
 * AC-7); FR-32's not-available answer is a gap with its reason, written as a note because the template has no state
 * for it (task-46 row (2)); a set is one answer per member chosen.
 */
export function holdingOf(
  field: Pick<DisclosureField, 'kind' | 'state' | 'notAvailableReason' | 'valueNumeric' | 'valueText' | 'valueBoolean' | 'valueDate'>,
): FieldHolding {
  if (field.state === DISCLOSURE_STATE.NOT_AVAILABLE) return { kind: FIELD_HOLDING.NOT_AVAILABLE, reason: field.notAvailableReason };
  if (field.state === DISCLOSURE_STATE.NIL_RETURN) return { kind: FIELD_HOLDING.ANSWERS, answers: [{ number: '0' }] };
  const text = field.valueText === null || field.valueText.trim() === '' ? null : field.valueText;
  const one = (answer: WorkbookAnswer | null): FieldHolding =>
    answer === null ? { kind: FIELD_HOLDING.NOTHING } : { kind: FIELD_HOLDING.ANSWERS, answers: [answer] };
  switch (field.kind) {
    case DISCLOSURE_KIND.NUMERIC:
    case DISCLOSURE_KIND.PERCENT:
    case DISCLOSURE_KIND.MONETARY:
      return one(field.valueNumeric === null ? null : { number: field.valueNumeric });
    case DISCLOSURE_KIND.TEXT:
    case DISCLOSURE_KIND.TEXT_BLOCK:
      return one(text === null ? null : { text });
    case DISCLOSURE_KIND.BOOLEAN:
      return one(field.valueBoolean === null ? null : { yes: field.valueBoolean });
    case DISCLOSURE_KIND.ENUMERATION:
      return one(text === null ? null : { member: text.trim() });
    case DISCLOSURE_KIND.ENUMERATION_SET: {
      const members = (text ?? '').split(MEMBER_SEPARATOR).filter((member) => member !== '');
      return members.length === 0
        ? { kind: FIELD_HOLDING.NOTHING }
        : { kind: FIELD_HOLDING.ANSWERS, answers: members.map((member) => ({ member })) };
    }
    // C3's years are four digits held as text (task 79.3), and the template takes them as the numbers they are.
    case DISCLOSURE_KIND.YEAR:
      return one(text === null ? null : { number: text.trim() });
    case DISCLOSURE_KIND.DATE:
      return one(field.valueDate === null ? null : { date: field.valueDate });
  }
}
