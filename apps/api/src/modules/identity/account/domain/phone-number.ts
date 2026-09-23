/**
 * A phone number as S-27 stores it (task 52.3; FR-9 amended): **international form, one spelling** — `+`, a country
 * code that does not start with zero, and at most fifteen digits in all (E.164's bound), with the spaces, dashes,
 * dots and brackets a person types stripped first. So `+373 69 123 456` and `+373-69-123456` are one value, and the
 * database's `account_phone_international` holds the same shape.
 *
 * **International only**, because the platform serves more than one country (NFR-4) and a local number is ambiguous
 * without one; the artboard draws the field pre-filled with `+373`. Answers `null` for nothing typed, and
 * `PHONE_MALFORMED` for something that is not a number of that shape — the caller refuses it rather than storing it.
 */
export const PHONE_MALFORMED = Symbol('PHONE_MALFORMED');

export const phoneNumber = (typed: string | null | undefined): string | null | typeof PHONE_MALFORMED => {
  const trimmed = typed?.trim() ?? '';
  if (trimmed === '') return null;
  const compact = trimmed.replace(SEPARATORS, '');
  return INTERNATIONAL.test(compact) ? compact : PHONE_MALFORMED;
};

const SEPARATORS = /[\s().-]/gu;
const INTERNATIONAL = /^\+[1-9][0-9]{6,14}$/u;
