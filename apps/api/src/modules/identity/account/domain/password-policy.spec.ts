import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, passwordMeetsPolicy } from './password-policy';

/**
 * The policy closed by OQ-51 on 20 Aug 2026, asserted at its edges rather than in the middle.
 *
 * The Unicode cases are the ones worth having: the live locales are Romanian and Russian, and an
 * ASCII class test would tell a Russian speaker their password contains no lowercase letter. That
 * failure is invisible to anyone testing in English, which is precisely why it is tested here.
 */
describe('password policy (OQ-51)', () => {
  const VALID = 'Parola123!';

  it('accepts a password meeting every requirement', () => {
    expect(passwordMeetsPolicy(VALID)).toBe(true);
  });

  describe('length', () => {
    it(`rejects one character below the ${PASSWORD_MIN_LENGTH}-character minimum`, () => {
      expect(passwordMeetsPolicy('Aa1!bcd')).toBe(false);
      expect(passwordMeetsPolicy('Aa1!bcde')).toBe(true);
    });

    it(`rejects one character above the ${PASSWORD_MAX_LENGTH}-character maximum`, () => {
      const filler = 'a'.repeat(PASSWORD_MAX_LENGTH - 4);
      expect(passwordMeetsPolicy(`Aa1!${filler}`)).toBe(true);
      expect(passwordMeetsPolicy(`Aa1!${filler}a`)).toBe(false);
    });

    // The ceiling is a cost bound on Argon2id, so it must count what a user typed rather than how
    // UTF-16 happens to store it. An emoji is two code units and one character.
    it('counts code points, not UTF-16 units', () => {
      const emoji = '\u{1F600}'.repeat(PASSWORD_MAX_LENGTH - 4);
      expect(emoji.length).toBeGreaterThan(PASSWORD_MAX_LENGTH);
      expect(passwordMeetsPolicy(`Aa1!${emoji}`)).toBe(true);
    });
  });

  describe('character classes', () => {
    it.each([
      ['no lowercase letter', 'PAROLA123!'],
      ['no uppercase letter', 'parola123!'],
      ['no digit', 'ParolaTest!'],
      ['no further character', 'Parola1234'],
    ])('rejects a password with %s', (_reason, password) => {
      expect(passwordMeetsPolicy(password)).toBe(false);
    });

    it('accepts Romanian letters as letters', () => {
      expect(passwordMeetsPolicy('Șterge1ăîț!')).toBe(true);
    });

    it('accepts Cyrillic letters as letters', () => {
      expect(passwordMeetsPolicy('Пароль1тест!')).toBe(true);
    });

    // A space is not a lowercase letter, an uppercase letter or a digit, so it satisfies "one
    // further character". Passphrases are the population this policy least wants to turn away.
    it('accepts a space as the further character', () => {
      expect(passwordMeetsPolicy('Parola 1234')).toBe(true);
    });
  });
});
