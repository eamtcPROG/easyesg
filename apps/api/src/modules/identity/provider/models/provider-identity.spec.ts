import { SOCIAL_PROVIDER } from '@api/contracts/identity-provider.port';
import { isLastCredential } from './provider-identity.model';

/**
 * BR-ID-4, as a truth table — the rule is one line and every one of its four cases has a
 * different answer, which is exactly why it is a named predicate rather than an `if` at the call
 * site. UC-12's consequence is unrecoverable and takes the account's memberships with it, so the
 * case that must never be wrong is the last row.
 */
const { GOOGLE, MICROSOFT } = SOCIAL_PROVIDER;

describe('isLastCredential (BR-ID-4)', () => {
  it('allows unlinking when a password remains', () => {
    expect(isLastCredential({ hasPassword: true, providers: [GOOGLE] }, GOOGLE)).toBe(false);
  });

  it('allows unlinking one of two providers on a password-less account', () => {
    expect(
      isLastCredential({ hasPassword: false, providers: [GOOGLE, MICROSOFT] }, GOOGLE),
    ).toBe(false);
  });

  it('refuses the only provider on an account with no password', () => {
    expect(isLastCredential({ hasPassword: false, providers: [GOOGLE] }, GOOGLE)).toBe(true);
  });

  // The rule counts what REMAINS, not what is held: unlinking something the account does not have
  // removes nothing, so it cannot be the last credential however few there are.
  it('is not tripped by unlinking a provider the account does not hold', () => {
    expect(isLastCredential({ hasPassword: false, providers: [GOOGLE] }, MICROSOFT)).toBe(false);
  });
});
