import { describe, expect, it } from 'vitest';
import { findInternalIdentifiers } from './internal-identifiers.js';

/**
 * **The detector's own tests, and they matter more than usual.**
 *
 * A content rule runs over a corpus that is meant to be clean, so a green gate proves nothing about
 * the gate — a regex that matches nothing looks exactly like a corpus with nothing to find. That is
 * the trap `boundaries:prove` exists for, applied to a pattern set. So the positives below are the
 * point, and the negatives are the reason the pattern set is shaped the way it is rather than as
 * the obvious first draft.
 */
describe('findInternalIdentifiers', () => {
  describe('catches what a reader must never be shown', () => {
    it.each([
      ['a specification identifier', 'Nu se poate continua (FR-102).'],
      ['a bare requirement code', 'See NFR-79 for the message shape.'],
      ['a business rule with a compound code', 'Refused by BR-ID-4.'],
      ['an enum member', 'The finding is a VALUE_INCONSISTENCY.'],
      ['a database object', 'Could not write to identity.credential.'],
      ['a snake_case token', 'The status is allow_with_warning.'],
      ['a column name', 'organization_id is required.'],
      ['a stack frame', 'Failed at Object.<anonymous> (/app/dist/main.js:1:1)'],
    ])('%s', (_name, text) => {
      expect(findInternalIdentifiers(text)).not.toEqual([]);
    });

    it('catches a declared term the caller knows is internal', () => {
      const findings = findInternalIdentifiers(
        'The request failed with credential-invalid.',
        ['credential-invalid', 'account-locked'],
      );
      expect(findings).toEqual([{ rule: 'a declared internal term', match: 'credential-invalid' }]);
    });

    it('catches a declared term whatever its case', () => {
      expect(findInternalIdentifiers('Credential-Invalid happened', ['credential-invalid'])).not.toEqual(
        [],
      );
    });
  });

  /**
   * **Every one of these was a false positive in the first draft**, which matched kebab-case as a
   * proxy for a problem-type slug. Nineteen hits in `ro.json`, none a defect. They are kept as tests
   * because the pressure to "just match kebab-case" will recur.
   */
  describe('leaves ordinary prose alone', () => {
    it.each([
      ['an English compound', 'Use your e-mail address to sign-in again.'],
      ['a Romanian clitic', 'Cererea s-a încheiat, deci nu v-am putut autentifica.'],
      ['another Romanian clitic', 'Cineva a acceptat-o deja, așa că nu o mai puteți folosi.'],
      ['a hyphenated adjective', 'This is a well-known limitation of two-factor sign-in.'],
      ['Russian prose', 'Пароль верный. Осталось ввести код — и мы откроем ваш аккаунт.'],
      ['an ordinary sentence with a number', 'Linkul expiră după 24 de ore.'],
      ['a capitalised brand', 'Continuați cu Google sau cu Microsoft.'],
    ])('%s', (_name, text) => {
      expect(findInternalIdentifiers(text)).toEqual([]);
    });

    /**
     * `ProblemType` carries `conflict` and `internal`. Matching them flagged the English
     * `problem.conflict.title` — which reads "Conflict" — as a defect, which is how this rule was
     * found. An identifier is recognisable by being un-word-like; a lowercase single word is not.
     */
    it('skips a declared term that is an ordinary lowercase word', () => {
      expect(findInternalIdentifiers('There is a conflict with the plan.', ['conflict'])).toEqual([]);
      expect(findInternalIdentifiers('An internal error occurred.', ['internal'])).toEqual([]);
    });

    it('still catches a mixed-case term, which no prose produces', () => {
      expect(
        findInternalIdentifiers('Missing EnergyConsumptionFromFuels', [
          'EnergyConsumptionFromFuels',
        ]),
      ).not.toEqual([]);
    });

    /**
     * A declared term must not fire on a word that merely contains it. The boundary rule is what
     * lets a caller declare a slug like `not-found` without flagging every sentence that happens to
     * contain "not found".
     */
    it('matches a declared term whole, never inside a longer word', () => {
      expect(findInternalIdentifiers('The invitation was not found.', ['not-found'])).toEqual([]);
      expect(findInternalIdentifiers('Re-sign-into the account', ['sign-in'])).toEqual([]);
    });
  });

  it('names the rule and the match, so a failure points at the thing', () => {
    expect(findInternalIdentifiers('Refused: identity.membership row missing')).toEqual([
      { rule: 'a database object', match: 'identity.membership' },
    ]);
  });
});
