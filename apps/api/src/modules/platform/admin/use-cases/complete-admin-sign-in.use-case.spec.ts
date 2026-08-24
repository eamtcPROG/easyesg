import { AuthRateLimitedError } from '@api/modules/identity/account/errors/account.errors';
import {
  ADMIN_CHALLENGE_KIND,
  type AdminChallengePayload,
} from '../domain/admin-challenge-codec';
import {
  AdminAccountLockedError,
  AdminFactorInvalidError,
  AdminSessionInvalidError,
} from '../errors/admin-session.errors';
import type { AdminTokens } from '../interfaces/admin-token.interface';
import { ADMIN_ROLE, type AdminAccount } from '../models/admin-session.model';
import { FakeAdminSessionStore } from '../testing/admin-session-store.fake';
import { CompleteAdminSignIn } from './complete-admin-sign-in.use-case';

/**
 * UC-68 step two — the factor half of the retired one-shot matrix, plus what only the
 * handshake has: the challenge's TTL, the mid-challenge re-read, and the property that a
 * wrong code leaves the challenge usable. TOTP inputs are RFC 6238's own vector, clock pinned
 * to its T, so the factor is exercised against real arithmetic.
 */
const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const RFC_CODE = '287082';
const RFC_NOW = new Date(59 * 1000);

const fakeTokens: AdminTokens = {
  sign: (sessionId, expiresAt) =>
    Promise.resolve(`admin-token:${sessionId}:${expiresAt.getTime()}`),
  verify: () => Promise.resolve(null),
  cookieKey: () => Buffer.alloc(32),
};

const operator = (overrides: Partial<AdminAccount> = {}): AdminAccount => ({
  id: '00000000-0000-7000-8000-00000000aaaa',
  email: 'operator@easyesg.md',
  role: ADMIN_ROLE.PLATFORM_ADMINISTRATOR,
  active: true,
  passwordHash: 'hashed:Parola123!',
  totpSecret: RFC_SECRET,
  failedAttempts: 0,
  lockedAt: null,
  createdAt: new Date('2026-08-01T00:00:00Z'),
  ...overrides,
});

const challenge = (overrides: Partial<AdminChallengePayload> = {}): AdminChallengePayload => ({
  kind: ADMIN_CHALLENGE_KIND,
  accountId: operator().id,
  email: 'operator@easyesg.md',
  role: ADMIN_ROLE.PLATFORM_ADMINISTRATOR,
  issuedAt: RFC_NOW.getTime() - 60 * 1000,
  ...overrides,
});

const build = (store: FakeAdminSessionStore, now: Date = RFC_NOW) =>
  new CompleteAdminSignIn(store, fakeTokens, () => now);

describe('CompleteAdminSignIn (UC-68 step two, FR-75)', () => {
  it('issues the session for the current code against an open challenge', async () => {
    const store = new FakeAdminSessionStore();
    store.accounts.push(operator({ failedAttempts: 3 }));

    const issued = await build(store).execute({ challenge: challenge(), totpCode: RFC_CODE });

    expect(issued.identity.email).toBe('operator@easyesg.md');
    expect(store.sessions).toHaveLength(1);
    expect(store.refreshTokens).toHaveLength(1);
    // Only the completed pair clears (step one proved it leaves the count alone).
    expect(store.accounts[0].failedAttempts).toBe(0);
    expect(issued.refreshTokenExpiresAt.getTime()).toBe(RFC_NOW.getTime() + 8 * 60 * 60 * 1000);
  });

  it('refuses a lapsed challenge with the generic invalid answer — back to the credential', async () => {
    const store = new FakeAdminSessionStore();
    store.accounts.push(operator());

    await expect(
      build(store).execute({
        challenge: challenge({ issuedAt: RFC_NOW.getTime() - 6 * 60 * 1000 }),
        totpCode: RFC_CODE,
      }),
    ).rejects.toBeInstanceOf(AdminSessionInvalidError);
    expect(store.sessions).toHaveLength(0);
  });

  it('a wrong code answers factor-invalid, counts toward the lockout, and does NOT kill the challenge', async () => {
    const store = new FakeAdminSessionStore();
    store.accounts.push(operator());
    const complete = build(store);
    const open = challenge();

    await expect(complete.execute({ challenge: open, totpCode: '000000' })).rejects.toBeInstanceOf(
      AdminFactorInvalidError,
    );
    expect(store.accounts[0].failedAttempts).toBe(1);
    expect(store.rollbacks).toBe(0);

    // A-01's "failed factor" is recoverable: the SAME challenge accepts the retyped code.
    const issued = await complete.execute({ challenge: open, totpCode: RFC_CODE });
    expect(issued.identity.id).toBe(operator().id);
  });

  it('re-reads the account: a deactivation or a lock landed mid-challenge wins', async () => {
    const deactivated = new FakeAdminSessionStore();
    deactivated.accounts.push(operator({ active: false }));
    await expect(
      build(deactivated).execute({ challenge: challenge(), totpCode: RFC_CODE }),
    ).rejects.toBeInstanceOf(AdminSessionInvalidError);

    const locked = new FakeAdminSessionStore();
    locked.accounts.push(operator({ lockedAt: new Date(RFC_NOW.getTime() - 1000) }));
    await expect(
      build(locked).execute({ challenge: challenge(), totpCode: RFC_CODE }),
    ).rejects.toBeInstanceOf(AdminAccountLockedError);
  });

  it('spends the same §12.5.6 window as step one — code attempts are throttled too', async () => {
    const store = new FakeAdminSessionStore();
    store.accounts.push(operator());
    const complete = build(store);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(
        complete.execute({ challenge: challenge(), totpCode: '000000' }),
      ).rejects.toBeInstanceOf(AdminFactorInvalidError);
    }
    await expect(
      complete.execute({ challenge: challenge(), totpCode: RFC_CODE }),
    ).rejects.toBeInstanceOf(AuthRateLimitedError);
    expect(store.attempts).toHaveLength(5);
  });
});
