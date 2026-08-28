import { describe, expect, it } from 'vitest';
import { idnoIsValid, leiIsValid, validateIdno, validateLei } from './entity-identifier.js';

/**
 * FR-16's identifiers, proven by a fixture corpus with valid and invalid cases both — task 29.2's
 * stated deliverable.
 *
 * **The LEIs below are real, published values from the GLEIF register**, not invented strings: a
 * checksum test whose fixtures were produced by the implementation under test proves only that the
 * implementation agrees with itself. Each is a well-known entity whose LEI is a matter of public
 * record, so the corpus can be checked against the source by anyone reviewing this file.
 */
describe('LEI (ISO 17442, ISO 7064 MOD 97-10)', () => {
  const VALID = [
    // Deutsche Bank AG
    '7LTWFZYICNSX8D621K86',
    // Barclays Bank PLC
    'G5GSEF7VJP5I7OUK5573',
    // JPMorgan Chase Bank, N.A.
    '7H6GLXDRUGQFU57RNE97',
    // BNP Paribas
    'R0MUWSFPU8MPRO8K5P83',
  ];

  it.each(VALID)('accepts %s', (lei) => {
    expect(validateLei(lei)).toEqual({ shape: true, checkDigits: true, satisfied: true });
  });

  it('rejects a transposition, which is what the check digits exist to catch', () => {
    // Two adjacent characters swapped in an otherwise valid LEI. A length-and-charset check passes
    // this happily; only the checksum sees it, which is the whole argument for running one.
    const transposed = '7LTWFZYICNSX8D62K186';
    expect(validateLei(transposed).shape).toBe(true);
    expect(validateLei(transposed).checkDigits).toBe(false);
    expect(leiIsValid(transposed)).toBe(false);
  });

  it('rejects a single altered character', () => {
    expect(leiIsValid('7LTWFZYICNSX8D621K87')).toBe(false);
  });

  it.each([
    ['too short', '7LTWFZYICNSX8D621K8'],
    ['too long', '7LTWFZYICNSX8D621K866'],
    ['lower case, which is a different string to ISO 7064', '7ltwfzyicnsx8d621k86'],
    ['a hyphen in place of a character', '7LTWFZYICNSX8D621-86'],
    ['letters where the check digits belong', '7LTWFZYICNSX8D621KAB'],
    ['empty', ''],
  ])('refuses %s on shape, without claiming a checksum verdict', (_label, value) => {
    // `checkDigits: null` rather than `false`: there was nothing well-formed to run a checksum
    // over, and NFR-79 needs "retype this" and "check you copied the right one" to stay apart.
    expect(validateLei(value)).toEqual({ shape: false, checkDigits: null, satisfied: false });
  });

  it('accepts non-zero characters at positions 5–6, which real LEIs carry', () => {
    // The first draft of this validator required `00` there, from a half-remembered reading of the
    // issuance scheme, and rejected every LEI in the corpus above. Kept as a test so the constraint
    // cannot come back: the normative check is length, character classes and MOD 97-10.
    expect(VALID.map((lei) => lei.slice(4, 6))).toEqual(['FZ', 'EF', 'LX', 'WS']);
    expect(VALID.every(leiIsValid)).toBe(true);
  });
});

/**
 * **The IDNO's check digit is deliberately not asserted here, and that absence is the point.**
 *
 * Government Decision 272/2002's Annex 2 — the instrument that defines the identifier — states at
 * point 5 that the thirteenth digit is a check digit and gives no algorithm for it; the word
 * *algoritm* does not appear in the text. Fixtures asserting a checksum would therefore have to be
 * produced by an invented algorithm, and a wrong one **rejects real IDNOs**: the failure mode is
 * refusing a correct registration at the door, which is worse than the filing-time error FR-16 is
 * written to prevent.
 *
 * So the corpus covers the structure the instrument does fix, and the verdict says plainly that the
 * checksum was not evaluated.
 */
describe('IDNO (Government Decision 272/2002, Annex 2, point 5)', () => {
  const VALID = [
    // Thirteen digits, laid out as index · year · office · sequence · check digit.
    '1003600158022',
    '1003600136646',
  ];

  it.each(VALID)('accepts the structure of %s', (idno) => {
    expect(validateIdno(idno)).toEqual({ shape: true, checkDigits: null, satisfied: true });
  });

  it('reports the checksum as not evaluated, which is not the same as passed', () => {
    // A caller must be able to tell "we checked and it is fine" from "we did not check". Collapsing
    // them to `true` would let a later reader believe FR-16's checksum clause is discharged.
    expect(validateIdno(VALID[0]).checkDigits).toBeNull();
  });

  it.each([
    ['twelve digits', '100360015802'],
    ['fourteen digits', '10036001580222'],
    ['a letter', '100360015802X'],
    ['a space', '100360015802 '],
    ['punctuation a copy-paste introduces', '1003-600158022'],
    ['empty', ''],
  ])('refuses %s', (_label, value) => {
    expect(validateIdno(value)).toEqual({ shape: false, checkDigits: null, satisfied: false });
    expect(idnoIsValid(value)).toBe(false);
  });
});
