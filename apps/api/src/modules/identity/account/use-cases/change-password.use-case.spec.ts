import {
  AuthRateLimitedError,
  PasswordPolicyViolationError,
  ReauthenticationFailedError,
} from '../errors/account.errors';
import { ACCOUNT_STATUS } from '../models/account.model';
import { FakeAccountStore, FakePasswordHasher } from '../testing/account-store.fake';
import { ChangePassword } from './change-password.use-case';

/**
 * UC-10 — change own password (FR-7).
 *
 * The requirement is two sentences and both of its clauses are load-bearing: *"a change without the
 * correct current password is refused"*, and *"where the user elects it, other active sessions are
 * terminated"*. **Where** is the word this suite spends most of its assertions on — the election is
 * opt-in, and the session the user is standing on is not one of the others.
 */
const CURRENT = 'ParolaVeche1!';
const NEXT = 'ParolaNoua2!';
const THIS_SESSION = 'session-here';

describe('ChangePassword (UC-10, FR-7)', () => {
  const now = new Date('2026-08-27T10:00:00Z');

  let store: FakeAccountStore;
  let hasher: FakePasswordHasher;
  let change: ChangePassword;

  const command = (overrides: Partial<Parameters<ChangePassword['execute']>[0]> = {}) => ({
    accountId: 'account-1',
    sessionId: THIS_SESSION,
    currentPassword: CURRENT,
    password: NEXT,
    terminateOtherSessions: false,
    ...overrides,
  });

  beforeEach(() => {
    store = new FakeAccountStore();
    hasher = new FakePasswordHasher();
    change = new ChangePassword(store, hasher, () => now);

    store.accounts.push({
      id: 'account-1',
      email: 'ana.popescu@example.md',
      status: ACCOUNT_STATUS.ACTIVE,
      locale: 'ro',
      verifiedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    store.credentials.set('account-1', {
      accountId: 'account-1',
      passwordHash: `hashed:${CURRENT}`,
      failedAttempts: 0,
      lockedAt: null,
    });
    store.sessions.push(
      { id: THIS_SESSION, accountId: 'account-1', revokedAt: null, revokedReason: null },
      { id: 'session-phone', accountId: 'account-1', revokedAt: null, revokedReason: null },
      { id: 'session-other-account', accountId: 'account-2', revokedAt: null, revokedReason: null },
    );
  });

  const liveSessions = () => store.sessions.filter((session) => session.revokedAt === null);

  it('replaces the password when the current one is right', async () => {
    await change.execute(command());

    expect(store.credentials.get('account-1')?.passwordHash).toBe(`hashed:${NEXT}`);
  });

  it('refuses a wrong current password and changes nothing', async () => {
    await expect(
      change.execute(command({ currentPassword: 'Gresita123!' })),
    ).rejects.toBeInstanceOf(ReauthenticationFailedError);

    expect(store.credentials.get('account-1')?.passwordHash).toBe(`hashed:${CURRENT}`);
  });

  // A provider-only account (FR-2) holds no credential row. Refused rather than allowed to set a
  // first password: FR-7 is a *change*, and creating one for a provider account is FR-8's, where
  // the rule that makes it safe — never remove the last credential — actually lives.
  it('refuses an account that has no password to change', async () => {
    store.credentials.delete('account-1');

    await expect(change.execute(command())).rejects.toBeInstanceOf(ReauthenticationFailedError);
  });

  it('checks the policy before spending an attempt, so a weak password costs typing only', async () => {
    await expect(change.execute(command({ password: 'weak' }))).rejects.toBeInstanceOf(
      PasswordPolicyViolationError,
    );

    // Nothing recorded: the ordering is what keeps a user from throttling themselves out by
    // typing a password their own screen was about to reject anyway.
    expect(store.attempts).toHaveLength(0);
  });

  describe("FR-7's election is opt-in, and 'other' excludes the current session", () => {
    it('leaves every session alone when the user does not elect it', async () => {
      const result = await change.execute(command({ terminateOtherSessions: false }));

      expect(result.otherSessionsTerminated).toBe(0);
      expect(liveSessions()).toHaveLength(3);
    });

    it('ends the other sessions and keeps the one the change was made from', async () => {
      const result = await change.execute(command({ terminateOtherSessions: true }));

      expect(result.otherSessionsTerminated).toBe(1);
      // The device the user is standing on still works — revoking it would sign them out of the
      // screen they just changed their password on, which reads as the change having failed.
      expect(liveSessions().map((session) => session.id)).toEqual([
        THIS_SESSION,
        'session-other-account',
      ]);
    });

    it('never reaches another account’s sessions', async () => {
      await change.execute(command({ terminateOtherSessions: true }));

      expect(
        store.sessions.find((session) => session.id === 'session-other-account')?.revokedAt,
      ).toBeNull();
    });

    it('records the revocation as a change, not as a reset', async () => {
      await change.execute(command({ terminateOtherSessions: true }));

      // The literal is the database's own vocabulary (the CHECK constraint), asserted as one on
      // purpose: the whole reason for the fourth value is that a support answer can distinguish
      // this from a reset link consumed by someone locked out.
      expect(store.sessions.find((session) => session.id === 'session-phone')?.revokedReason).toBe(
        'password_changed',
      );
    });

    it('reports zero honestly when there were no other sessions', async () => {
      store.sessions = store.sessions.filter((session) => session.id !== 'session-phone');

      const result = await change.execute(command({ terminateOtherSessions: true }));

      // "Signed out of your other devices" is a lie if there were none, so the count travels.
      expect(result.otherSessionsTerminated).toBe(0);
    });
  });

  describe('§12.5.6 re-authentication throttle (task 27.5)', () => {
    it('refuses beyond the window, so the route is not a password oracle', async () => {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await expect(
          change.execute(command({ currentPassword: 'Gresita123!' })),
        ).rejects.toBeInstanceOf(ReauthenticationFailedError);
      }

      // Even the CORRECT password is refused now — the window bounds the route, not the guess.
      await expect(change.execute(command())).rejects.toBeInstanceOf(AuthRateLimitedError);
    });

    it('counts a refused attempt durably, which a single transaction would have rolled back', async () => {
      await expect(
        change.execute(command({ currentPassword: 'Gresita123!' })),
      ).rejects.toBeInstanceOf(ReauthenticationFailedError);

      expect(store.attempts).toHaveLength(1);
    });

    it('does not touch FR-4’s lockout — a mistype here must not sign the user out everywhere', async () => {
      await expect(
        change.execute(command({ currentPassword: 'Gresita123!' })),
      ).rejects.toBeInstanceOf(ReauthenticationFailedError);

      const credential = store.credentials.get('account-1');
      expect(credential?.failedAttempts).toBe(0);
      expect(credential?.lockedAt).toBeNull();
    });
  });
});
