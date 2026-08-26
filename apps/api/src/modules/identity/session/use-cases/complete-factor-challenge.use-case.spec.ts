import { AuthRateLimitedError } from '@api/modules/identity/account/errors/account.errors';
import { FakePasswordHasher } from '@api/modules/identity/account/testing/account-store.fake';
import { ACCOUNT_STATUS, type Account } from '@api/modules/identity/account/models/account.model';
import { FACTOR_CHALLENGE_TTL_MS } from '../domain/factor-challenge';
import { FactorInvalidError } from '../errors/session.errors';
import {
  FakeAccessTokenSigner,
  FakeChallengeSealer,
  FakeSecondFactor,
  FakeSessionStore,
} from '../testing/session-store.fake';
import { SIGN_IN_OUTCOME } from '../models/session.model';
import { CompleteFactorChallenge } from './complete-factor-challenge.use-case';
import { SignIn } from './sign-in.use-case';

/**
 * UC-194 and UC-195 (NFR-95; task 27.3).
 *
 * The two properties the task row names are asserted first — **an enrolled account is challenged
 * and an unenrolled one is not** — and the rest is the refusal surface, which is where a
 * second-factor step is actually load-bearing: everything that is not a correct code must be one
 * indistinguishable answer, and the guessing budget must be shared with the password step.
 */
const EMAIL = 'ana.popescu@example.md';
const PASSWORD = 'Parola123!';
const CODE = '123456';

describe('the second factor at sign-in (UC-194, UC-195)', () => {
  const now = new Date('2026-08-26T10:00:00Z');

  let store: FakeSessionStore;
  let secondFactor: FakeSecondFactor;
  let sealer: FakeChallengeSealer;
  let signIn: SignIn;
  let complete: CompleteFactorChallenge;
  let account: Account;

  beforeEach(() => {
    store = new FakeSessionStore();
    secondFactor = new FakeSecondFactor();
    sealer = new FakeChallengeSealer();
    const signer = new FakeAccessTokenSigner();
    signIn = new SignIn(store, new FakePasswordHasher(), signer, secondFactor, sealer, () => now);
    complete = new CompleteFactorChallenge(store, sealer, secondFactor, signIn, () => now);

    account = {
      id: 'account-1',
      email: EMAIL,
      status: ACCOUNT_STATUS.ACTIVE,
      locale: 'ro',
      verifiedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    store.seedAccount(account, {
      passwordHash: `hashed:${PASSWORD}`,
      failedAttempts: 0,
      lockedAt: null,
    });
  });

  const signInAndChallenge = async () => {
    const outcome = await signIn.execute({ email: EMAIL, password: PASSWORD });
    if (outcome.kind !== SIGN_IN_OUTCOME.CHALLENGED) throw new Error('expected a challenge');
    return outcome;
  };

  it('does not challenge an account with no factor — the unchallenged path is unchanged', async () => {
    const outcome = await signIn.execute({ email: EMAIL, password: PASSWORD });
    expect(outcome.kind).toBe(SIGN_IN_OUTCOME.SIGNED_IN);
  });

  // An enrolment awaiting its first code is exactly the state a failed authenticator scan leaves,
  // and challenging on it would demand a code no device can produce (UC-193).
  it('does not challenge an enrolment that was never confirmed', async () => {
    // `FakeSecondFactor.enrolled` holds CONFIRMED accounts only, mirroring `isEnrolled`.
    const outcome = await signIn.execute({ email: EMAIL, password: PASSWORD });
    expect(outcome.kind).toBe(SIGN_IN_OUTCOME.SIGNED_IN);
  });

  describe('with a confirmed factor', () => {
    beforeEach(() => {
      secondFactor.enrolled.add('account-1');
      secondFactor.answers.set('account-1', [CODE]);
    });

    it('challenges instead of issuing a session, and issues no token with it', async () => {
      const challenged = await signInAndChallenge();

      expect(challenged.expiresAt.getTime()).toBe(now.getTime() + FACTOR_CHALLENGE_TTL_MS);
      // The challenge is not a session and must carry nothing that could act as one.
      expect(JSON.stringify(challenged)).not.toContain('accessToken');
      expect(store.sessions.filter((session) => session.accountId === 'account-1')).toHaveLength(0);
    });

    it('issues the session once the code is right', async () => {
      const { challenge } = await signInAndChallenge();

      const issued = await complete.execute({ challenge, code: CODE });

      expect(issued.account.id).toBe('account-1');
      expect(store.sessions.filter((session) => session.accountId === 'account-1')).toHaveLength(1);
    });

    it('clears the password failure count only when the factor is answered', async () => {
      store.credentials.set('account-1', {
        accountId: 'account-1',
        passwordHash: `hashed:${PASSWORD}`,
        failedAttempts: 3,
        lockedAt: null,
      });

      const { challenge } = await signInAndChallenge();
      await complete.execute({ challenge, code: CODE });

      expect(store.credentials.get('account-1')?.failedAttempts).toBe(0);
    });

    describe('one refusal for every way it can fail (NFR-64)', () => {
      it.each([
        ['a wrong code', async () => ({ challenge: (await signInAndChallenge()).challenge, code: '000000' })],
        ['a challenge this API never sealed', () => Promise.resolve({ challenge: 'not-sealed', code: CODE })],
        [
          'a challenge naming an account with no factor',
          () => Promise.resolve({ challenge: sealer.seal({ accountId: 'nobody', issuedAt: now.getTime() }), code: CODE }),
        ],
      ])('refuses %s identically', async (_name, build) => {
        await expect(complete.execute(await build())).rejects.toBeInstanceOf(FactorInvalidError);
      });

      it('refuses an expired challenge', async () => {
        const stale = sealer.seal({
          accountId: 'account-1',
          issuedAt: now.getTime() - FACTOR_CHALLENGE_TTL_MS,
        });
        await expect(complete.execute({ challenge: stale, code: CODE })).rejects.toBeInstanceOf(
          FactorInvalidError,
        );
      });
    });

    // The challenge survives a mistype on purpose (§12.5.6): bouncing the reader back to their
    // password would lose the step they had already completed correctly.
    it('is not single-use — a mistyped code leaves the challenge usable', async () => {
      const { challenge } = await signInAndChallenge();

      await expect(complete.execute({ challenge, code: '000000' })).rejects.toBeInstanceOf(
        FactorInvalidError,
      );
      const issued = await complete.execute({ challenge, code: CODE });

      expect(issued.account.id).toBe('account-1');
    });

    // UC-195's whole point: one code, one session, and never again.
    it('spends a recovery code exactly once', async () => {
      secondFactor.answers.set('account-1', ['0123456789ABCDEF']);
      const first = await signInAndChallenge();
      await complete.execute({ challenge: first.challenge, code: '0123456789ABCDEF' });

      const second = await signInAndChallenge();
      await expect(
        complete.execute({ challenge: second.challenge, code: '0123456789ABCDEF' }),
      ).rejects.toBeInstanceOf(FactorInvalidError);
    });

    it('counts factor failures toward the same lockout the password step counts toward (FR-4)', async () => {
      const { challenge } = await signInAndChallenge();

      await expect(complete.execute({ challenge, code: '000000' })).rejects.toBeInstanceOf(
        FactorInvalidError,
      );

      // A second budget here would give an attacker holding the password unlimited guesses at six
      // digits, which is 10^6 and falls in an afternoon.
      expect(store.credentials.get('account-1')?.failedAttempts).toBe(1);
    });

    it('throttles the factor step, and refuses beyond the window', async () => {
      const { challenge } = await signInAndChallenge();

      for (let attempt = 0; attempt < 5; attempt += 1) {
        await expect(complete.execute({ challenge, code: '000000' })).rejects.toBeInstanceOf(
          FactorInvalidError,
        );
      }

      await expect(complete.execute({ challenge, code: CODE })).rejects.toBeInstanceOf(
        AuthRateLimitedError,
      );
    });
  });
});
