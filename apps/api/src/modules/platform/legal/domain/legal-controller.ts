import { validateIdno } from '@easyesg/validation';
import { isEmail } from 'class-validator';

/**
 * The controller the terms of service and the privacy notice name (task 75; FR-205; `architecture.md` §12.5.6's
 * task-75 row (7)) — the platform's operator as registered: its name, its IDNO, its registered address and the
 * address data-protection questions go to. **Facts, not wording**: each is one value as registered, shown as it is in
 * every locale, which is why they may be configuration while the documents' text is committed to the release
 * (182/116).
 */
export interface LegalController {
  readonly registeredName: string;
  readonly idno: string;
  readonly registeredAddress: string;
  readonly dataProtectionEmail: string;
}

/**
 * Why a controller cannot be published — the first, in the order A-21 lays its fields out. One vocabulary for the
 * console's refusal and for the store's, so what A-21 refuses and what the seed loader refuses cannot differ.
 */
export const LEGAL_CONTROLLER_FAULT = {
  NAME_MISSING: 'name_missing',
  IDNO_MISSING: 'idno_missing',
  IDNO_MALFORMED: 'idno_malformed',
  IDNO_CHECK_DIGIT: 'idno_check_digit',
  ADDRESS_MISSING: 'address_missing',
  EMAIL_MISSING: 'email_missing',
  EMAIL_MALFORMED: 'email_malformed',
} as const;

export type LegalControllerFault = (typeof LEGAL_CONTROLLER_FAULT)[keyof typeof LEGAL_CONTROLLER_FAULT];

/** Each field with its surrounding space removed — what is stored and what is compared. */
export const trimmedLegalController = (controller: LegalController): LegalController => ({
  registeredName: controller.registeredName.trim(),
  idno: controller.idno.trim(),
  registeredAddress: controller.registeredAddress.trim(),
  dataProtectionEmail: controller.dataProtectionEmail.trim(),
});

/**
 * The first fault of a trimmed controller, or `null`. **The IDNO is judged by the rule a reporting entity's is**
 * (`@easyesg/validation`), so the operator's number and a customer's cannot be held to different standards; the
 * address by `class-validator`'s `isEmail`, the function the api's DTOs already judge an address with.
 */
export const legalControllerFault = (controller: LegalController): LegalControllerFault | null => {
  if (controller.registeredName === '') return LEGAL_CONTROLLER_FAULT.NAME_MISSING;
  if (controller.idno === '') return LEGAL_CONTROLLER_FAULT.IDNO_MISSING;
  const idno = validateIdno(controller.idno);
  if (!idno.shape) return LEGAL_CONTROLLER_FAULT.IDNO_MALFORMED;
  if (idno.checkDigits === false) return LEGAL_CONTROLLER_FAULT.IDNO_CHECK_DIGIT;
  if (controller.registeredAddress === '') return LEGAL_CONTROLLER_FAULT.ADDRESS_MISSING;
  if (controller.dataProtectionEmail === '') return LEGAL_CONTROLLER_FAULT.EMAIL_MISSING;
  if (!isEmail(controller.dataProtectionEmail)) return LEGAL_CONTROLLER_FAULT.EMAIL_MALFORMED;
  return null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * A payload read as a controller, trimmed, or `null` — **read whole or not at all**: a payload missing a field, or
 * holding one A-21 would refuse, is no controller, because a document naming half of one is the thing the task-75
 * row (7) keeps from going live.
 */
export const readLegalController = (payload: unknown): LegalController | null => {
  if (!isRecord(payload)) return null;
  const { registeredName, idno, registeredAddress, dataProtectionEmail } = payload;
  if (
    typeof registeredName !== 'string' ||
    typeof idno !== 'string' ||
    typeof registeredAddress !== 'string' ||
    typeof dataProtectionEmail !== 'string'
  ) {
    return null;
  }
  const controller = trimmedLegalController({ registeredName, idno, registeredAddress, dataProtectionEmail });
  return legalControllerFault(controller) === null ? controller : null;
};

/**
 * Why the store refuses a payload of this kind, or `null` — asked by `ConfigurationPublisher` before it writes, the
 * seed loader included (`configuration-kind-rules.ts`), so a malformed controller is refused where it can be
 * corrected rather than found by the terms of service answering *not yet available*.
 */
export const legalControllerRefusal = (payload: unknown): string | null =>
  readLegalController(payload) === null
    ? 'a legal controller read whole: a registered name, an IDNO with a valid check digit, a registered address and an email address, none blank'
    : null;

/** Whether two controllers say the same thing — a save identical to what is in force is refused, not recorded. */
export const legalControllersAreEqual = ({ a, b }: { readonly a: LegalController; readonly b: LegalController }) =>
  a.registeredName === b.registeredName &&
  a.idno === b.idno &&
  a.registeredAddress === b.registeredAddress &&
  a.dataProtectionEmail === b.dataProtectionEmail;
