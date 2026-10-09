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
 * **The IDNO's two published numbers are the fixtures the check rests on** (§12.5.6's task-182 row, 182/12): the
 * first twelve digits weighted 7, 3, 1 repeating, the sum modulo 10 being the thirteenth. The decree that defines the
 * identifier names the check digit and gives no algorithm (§7.2), so these are values from the register rather than
 * strings this file produced — and the corpus's two older fixtures, taken from real registrations before the
 * algorithm was known, agree with it independently.
 */
describe('IDNO (Government Decision 272/2002, Annex 2, point 5; check digit 7-3-1 modulo 10)', () => {
  const VALID = [
    // The two numbers 182/12 verified the algorithm on.
    '1003600005148',
    '1017600033216',
    // Taken from real registrations on 28 Aug 2026, when only the shape was checked.
    '1003600158022',
    '1003600136646',
  ];

  it.each(VALID)('accepts %s, check digit included', (idno) => {
    expect(validateIdno(idno)).toEqual({ shape: true, checkDigits: true, satisfied: true });
    expect(idnoIsValid(idno)).toBe(true);
  });

  it.each([
    ['the first published number, its last digit mutated', '1003600005149'],
    ['the second published number, its last digit mutated', '1017600033217'],
  ])('refuses %s on the check digit, not on the shape', (_label, idno) => {
    // `checkDigits: false` rather than `null`: thirteen digits were there to check, and NFR-79 needs "check you copied
    // the right one" kept apart from "retype it".
    expect(validateIdno(idno)).toEqual({ shape: true, checkDigits: false, satisfied: false });
    expect(idnoIsValid(idno)).toBe(false);
  });

  it('refuses a single digit altered inside the number, which the weights exist to catch', () => {
    // Every weight is coprime to 10, so changing any one digit moves the sum's last digit. Position 10 carries weight 7.
    expect(validateIdno('1003600006148').checkDigits).toBe(false);
  });

  it('refuses a transposition of two adjacent digits that do not differ by five', () => {
    // `…0005148` → `…0001548`: the 5 and the 1 at positions 10 and 11 swapped. Adjacent weights differ by 2, 4 or 6, so
    // a swap moves the sum's last digit unless the two digits differ by five — the one transposition this check
    // cannot see, which is why the refusal's wording says "usually" rather than "always".
    expect(validateIdno('1003600001548')).toEqual({ shape: true, checkDigits: false, satisfied: false });
  });

  it.each([
    ['twelve digits', '100360015802'],
    ['fourteen digits', '10036001580222'],
    ['a letter', '100360015802X'],
    ['a space', '100360015802 '],
    ['punctuation a copy-paste introduces', '1003-600158022'],
    ['empty', ''],
  ])('refuses %s on shape, without claiming a check-digit verdict', (_label, value) => {
    expect(validateIdno(value)).toEqual({ shape: false, checkDigits: null, satisfied: false });
    expect(idnoIsValid(value)).toBe(false);
  });
});
