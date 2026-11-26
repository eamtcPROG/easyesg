import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  idnoIsValid,
  leiIsValid,
  validateIdno,
  validateLei,
  type IdentifierVerdict,
} from './entity-identifier.js';

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

/**
 * **What each identifier's check digits catch, as a property** (task 212; NFR-88; §12.5.6's task-212 row (3)). Each
 * valid identifier is built by this spec's own arithmetic — the IDNO's weights, ISO 7064's MOD 97-10 in `bigint` — not
 * by the module, and then every character of it is replaced, in turn, by every other character a person might type.
 *
 * **The two identifiers differ, and the properties say so.** The IDNO's weights 7, 3 and 1 are each prime to 10, so
 * any single digit changed moves the sum's last digit: every such change is refused. The LEI's MOD 97-10 reads a
 * letter as two digits, so a digit typed for a letter, or a letter for a digit, moves every digit before it and can
 * keep the remainder — that change is not always caught, and no check the standard allows could catch it. The
 * property asserts what the scheme does catch, and the last case pins what it does not.
 *
 * **A fresh seed every run.** A failure prints its seed and the smallest case it shrank to; that case then joins the
 * examples above.
 */
describe('single-character errors, as a property (task 212)', () => {
  const DIGITS = '0123456789';
  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  /** What a person might type in a character's place: the identifiers' own alphabet, and what a slip or a paste brings. */
  const TYPED = [...DIGITS, ...LETTERS, ...LETTERS.toLowerCase(), ' ', '-', '.', '/', 'Ș', 'О'];

  const digits = (length: number) => fc.string({ unit: fc.constantFrom(...DIGITS), minLength: length, maxLength: length });

  const SHAPE_REFUSED: IdentifierVerdict = { shape: false, checkDigits: null, satisfied: false };
  const CHECK_DIGITS_REFUSED: IdentifierVerdict = { shape: true, checkDigits: false, satisfied: false };
  const same = (left: IdentifierVerdict, right: IdentifierVerdict): boolean =>
    left.shape === right.shape && left.checkDigits === right.checkDigits && left.satisfied === right.satisfied;

  /** Every value one character away from `value`, with the position changed and what it now holds. */
  const slips = (value: string) =>
    [...value].flatMap((held, position) =>
      TYPED.filter((typed) => typed !== held).map((typed) => ({
        position,
        held,
        typed,
        slipped: `${value.slice(0, position)}${typed}${value.slice(position + 1)}`,
      })),
    );

  describe('IDNO', () => {
    const WEIGHTS = [7, 3, 1];
    const withCheckDigit = (twelve: string): string =>
      `${twelve}${[...twelve].reduce((sum, digit, position) => sum + Number(digit) * WEIGHTS[position % 3], 0) % 10}`;

    it('refuses every single character changed: a digit on the check digit, anything else on the shape', () => {
      fc.assert(
        fc.property(digits(12).map(withCheckDigit), (idno) => {
          expect(validateIdno(idno).satisfied).toBe(true);
          const missed = slips(idno)
            .filter(({ typed, slipped }) =>
              !same(validateIdno(slipped), DIGITS.includes(typed) ? CHECK_DIGITS_REFUSED : SHAPE_REFUSED),
            )
            .map(({ slipped }) => slipped);
          expect(missed).toEqual([]);
        }),
      );
    });
  });

  describe('LEI', () => {
    const ALPHANUMERIC = fc.constantFrom(...DIGITS, ...LETTERS);
    /** ISO 7064 MOD 97-10 over the value as digits, each letter its two (`A` = 10 … `Z` = 35). */
    const remainder = (value: string): bigint =>
      BigInt([...value].map((character) => parseInt(character, 36).toString()).join('')) % 97n;
    const withCheckDigits = (eighteen: string): string =>
      `${eighteen}${String(98n - remainder(`${eighteen}00`)).padStart(2, '0')}`;

    const sameClass = (held: string, typed: string): boolean =>
      (DIGITS.includes(held) && DIGITS.includes(typed)) || (LETTERS.includes(held) && LETTERS.includes(typed));
    /** ISO 17442's alphabet at a position: upper-case letters and digits, and digits alone in the last two. */
    const admits = (position: number, typed: string): boolean =>
      DIGITS.includes(typed) || (LETTERS.includes(typed) && position < 18);

    it('refuses a digit changed for a digit and a letter for a letter on the check digits, and anything outside the alphabet on the shape', () => {
      fc.assert(
        fc.property(fc.string({ unit: ALPHANUMERIC, minLength: 18, maxLength: 18 }).map(withCheckDigits), (lei) => {
          expect(validateLei(lei).satisfied).toBe(true);
          const missed = slips(lei)
            .filter(({ position, held, typed }) => !admits(position, typed) || sameClass(held, typed))
            .filter(({ position, typed, slipped }) =>
              !same(validateLei(slipped), admits(position, typed) ? CHECK_DIGITS_REFUSED : SHAPE_REFUSED),
            )
            .map(({ slipped }) => slipped);
          expect(missed).toEqual([]);
        }),
      );
    });

    it('cannot see every digit typed for a letter: the gap ISO 7064 leaves, pinned on a published LEI', () => {
      // Deutsche Bank's `7LTWFZYICNSX8D621K86` with its `I` read as `3` at position 8. MOD 97-10 gives both the same
      // remainder, so a reporter who mistypes it this way is not told. Measured 22 Nov 2026: 1,863 of 2,000 random LEIs
      // have at least one such slip. A check beyond the standard's would refuse valid identifiers, so none is added.
      expect(validateLei('7LTWFZY3CNSX8D621K86')).toEqual({ shape: true, checkDigits: true, satisfied: true });
    });
  });
});
