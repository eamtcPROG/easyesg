import type { LegalControllerRecord, PublishLegalControllerRequest } from '@easyesg/contracts';
import { validateIdno } from '@easyesg/validation';

/**
 * A-21's form and the wire (task 75). The fields go to the api as typed: trimming is the api's, by the function its
 * publication rule reads, so the form and the store cannot disagree about what was saved.
 */
export interface LegalControllerFields {
  registeredName: string;
  idno: string;
  registeredAddress: string;
  dataProtectionEmail: string;
}

export const legalControllerFieldsOf = (record: LegalControllerRecord): LegalControllerFields => ({
  registeredName: record.registeredName,
  idno: record.idno,
  registeredAddress: record.registeredAddress,
  dataProtectionEmail: record.dataProtectionEmail,
});

export const publicationRequestOf = (input: {
  readonly fields: LegalControllerFields;
  /** The revision the form opened on — what the api refuses the save against if another is in force. */
  readonly revision: number;
}): PublishLegalControllerRequest => ({ ...input.fields, revision: input.revision });

/** What the IDNO field says of a value, before the round trip — the three answers its rule can give. */
export const IDNO_FIELD_VERDICT = {
  VALID: 'valid',
  MALFORMED: 'malformed',
  CHECK_DIGIT: 'check_digit',
} as const;

export type IdnoFieldVerdict = (typeof IDNO_FIELD_VERDICT)[keyof typeof IDNO_FIELD_VERDICT];

/**
 * **The rule a reporting entity's IDNO is judged by**, from `@easyesg/validation` — the api judges the operator's with
 * the same function, so the inline verdict and the refusal cannot differ (`CLAUDE.md`, §9.8). A blank value is the
 * field's *required* check, not this one's.
 */
export const idnoFieldVerdict = (value: string): IdnoFieldVerdict => {
  const verdict = validateIdno(value.trim());
  if (!verdict.shape) return IDNO_FIELD_VERDICT.MALFORMED;
  return verdict.checkDigits === false ? IDNO_FIELD_VERDICT.CHECK_DIGIT : IDNO_FIELD_VERDICT.VALID;
};
