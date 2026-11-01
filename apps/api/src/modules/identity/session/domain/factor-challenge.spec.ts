import {
  FACTOR_CHALLENGE_KIND,
  factorChallengeHasExpired,
  readFactorChallenge,
} from './factor-challenge';

/**
 * `readFactorChallenge`'s refusals — the module had no spec at all until task 97, and the field it
 * gained is one whose **absence must refuse** rather than default.
 *
 * That is the unusual direction for a reader in this codebase, and it is the one the gate review
 * found unguarded: replacing the boolean check with a coercion left all 639 api tests green. The
 * strictness is the feature — a challenge sealed by a build that did not know the question cannot
 * be answered on the person's behalf — and its cost is recorded as one retype inside a five-minute
 * window, which is only an acceptable cost if the refusal actually happens.
 */
const VALID = {
  kind: FACTOR_CHALLENGE_KIND,
  accountId: 'c0ffee00-0000-7000-8000-000000000001',
  issuedAt: 1_787_444_100_000,
  remembered: true,
};

describe('the factor challenge payload (task 27.3, OQ-35)', () => {
  it('reads a complete payload back unchanged', () => {
    expect(readFactorChallenge(VALID)).toEqual(VALID);
  });

  it('refuses a payload sealed before the persistence choice existed', () => {
    const { remembered: _dropped, ...legacy } = VALID;
    expect(readFactorChallenge(legacy)).toBeNull();
  });

  it('refuses a persistence choice that is not a boolean', () => {
    // A truthy string would coerce to "remembered" under a `=== true` or `!!` read, which is the
    // mutation this case exists to kill: it must be no challenge, not a long session.
    expect(readFactorChallenge({ ...VALID, remembered: 'true' })).toBeNull();
  });

  it.each([
    ['not an object', 'nonsense'],
    ['another kind of sealed value', { ...VALID, kind: 'admin-challenge' }],
    ['no account', { ...VALID, accountId: 42 }],
    ['no issuance instant', { ...VALID, issuedAt: '2026-08-21' }],
  ])('refuses %s', (_label, parsed) => {
    expect(readFactorChallenge(parsed)).toBeNull();
  });

  it('expires AT its bound, not only past it', () => {
    const challenge = readFactorChallenge(VALID);
    expect(challenge).not.toBeNull();
    const bound = VALID.issuedAt + 5 * 60 * 1000;
    expect(factorChallengeHasExpired(challenge!, new Date(bound - 1))).toBe(false);
    expect(factorChallengeHasExpired(challenge!, new Date(bound))).toBe(true);
  });
});
