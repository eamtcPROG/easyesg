import { ACCOUNT_SETUP_PROOF_WINDOW_MS, setupIsComplete, setupProofIsFresh } from './account-setup';

describe('account setup (task 155)', () => {
  describe('setupIsComplete', () => {
    const complete = { hasPassword: true, givenName: 'Ana', familyName: 'Popescu' };

    it('is complete with a password and both name parts', () => {
      expect(setupIsComplete(complete)).toBe(true);
    });

    it.each([
      ['no password', { ...complete, hasPassword: false }],
      ['no given name', { ...complete, givenName: null }],
      ['no family name', { ...complete, familyName: null }],
      // A provider's seeded display name alone is the common case, and it is not enough.
      ['only the name a provider seeded', { hasPassword: true, givenName: 'Ana Popescu', familyName: null }],
      ['a whitespace-only family name', { ...complete, familyName: '   ' }],
    ])('is not complete with %s', (_label, facts) => {
      expect(setupIsComplete(facts)).toBe(false);
    });
  });

  describe('setupProofIsFresh', () => {
    const provedAt = new Date('2026-09-14T10:00:00Z');
    const after = (ms: number) => new Date(provedAt.getTime() + ms);

    it('admits a proof one millisecond inside the window', () => {
      expect(setupProofIsFresh({ provedAt }, after(ACCOUNT_SETUP_PROOF_WINDOW_MS - 1))).toBe(true);
    });

    it('refuses a proof at exactly fifteen minutes', () => {
      expect(ACCOUNT_SETUP_PROOF_WINDOW_MS).toBe(15 * 60 * 1000);
      expect(setupProofIsFresh({ provedAt }, after(ACCOUNT_SETUP_PROOF_WINDOW_MS))).toBe(false);
    });
  });
});
