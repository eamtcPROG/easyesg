import { validateIdno, validateLei, type IdentifierVerdict } from '@easyesg/validation';

/**
 * What is wrong with an identifier as S-13's reader typed it (FR-16) — the IDNO's and the LEI's inline verdicts, out of
 * the identity section so each is a unit spec rather than a browser journey (task 188).
 *
 * **The verdict is `@easyesg/validation`'s**, the functions the api re-validates with, so the screen and the server
 * cannot disagree (§9.8). What this adds is only the reading a field needs: the value as the save will send it, and a
 * blank field — which clears the identifier — found faultless.
 *
 * **Two faults, because there are two resolutions**: a malformed value is retyped, and one whose check digits disagree
 * means the wrong number was copied, which is the same split the api makes with its two problem types.
 */
export const IDENTIFIER_FAULT = {
  /** Not the identifier's length or characters. */
  MALFORMED: 'malformed',
  /** The right shape, and its check digits disagree with the rest. */
  CHECK_DIGITS: 'check_digits',
} as const;

export type IdentifierFault = (typeof IDENTIFIER_FAULT)[keyof typeof IDENTIFIER_FAULT];

const faultOf = (verdict: IdentifierVerdict): IdentifierFault | null => {
  if (!verdict.shape) return IDENTIFIER_FAULT.MALFORMED;
  return verdict.checkDigits === true ? null : IDENTIFIER_FAULT.CHECK_DIGITS;
};

/** The IDNO as `toRequest` sends it — trimmed — or `null` when it is blank or holds. */
export function idnoFault(typed: string): IdentifierFault | null {
  const value = typed.trim();
  return value ? faultOf(validateIdno(value)) : null;
}

/** The LEI as `toRequest` sends it — trimmed and upper-cased — or `null` when it is blank or holds. */
export function leiFault(typed: string): IdentifierFault | null {
  const value = typed.trim().toUpperCase();
  return value ? faultOf(validateLei(value)) : null;
}
