import { AuthRateLimitedError } from '@api/modules/identity/account/errors/account.errors';
import type { PasswordHasher } from '@api/modules/identity/account/interfaces/password-hasher.interface';
import {
  AdminAccountLockedError,
  AdminCredentialInvalidError,
  AdminFactorInvalidError,
} from '../errors/admin-session.errors';
import type { AdminTokens } from '../interfaces/admin-token.interface';
import { ADMIN_ROLE, type AdminAccount } from '../models/admin-session.model';
import { FakeAdminSessionStore } from '../testing/admin-session-store.fake';
import { SignInAdmin } from './sign-in-admin.use-case';

/**
 * UC-68's matrix. The TOTP inputs are RFC 6238's own vector — secret and code from the
 * appendix, the clock pinned to its T — so the factor step is exercised against real
 * arithmetic rather than a stubbed verifier that would pass a broken one.
 */
const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const RFC_CODE = '287082';
const RFC_NOW = new Date(59 * 1000);

const fakeHasher: PasswordHasher = {
  hash: (password) => Promise.resolve(`hashed:${password}`),
  verify: ({ digest, password }) => Promise.resolve(digest === `hashed:${password}`),
};

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

const command = (overrides: Partial<{ email: string; password: string; totpCode: string }> = {}) => ({
  email: 'operator@easyesg.md',
  password: 'Parola123!',
  totpCode: RFC_CODE,
  ...overrides,
});

function build(store: FakeAdminSessionStore, now: Date = RFC_NOW): SignInAdmin {
  return new SignInAdmin(store, fakeHasher, fakeTokens, () => now);
}

describe('SignInAdmin (UC-68, FR-75)', () => {
  it('issues a session for the correct credential and current code', async () => {
    const store = new FakeAdminSessionStore();
    store.accounts.push(operator());

    const issued = await build(store).execute(command());

    expect(issued.identity).toEqual({
      id: operator().id,
      email: 'operator@easyesg.md',
      role: ADMIN_ROLE.PLATFORM_ADMINISTRATOR,
    });
    expect(store.sessions).toHaveLength(1);
    expect(store.refreshTokens).toHaveLength(1);
    // 8 h idle from issuance beats 12 h absolute from the same instant (§12.5.6).
    expect(issued.refreshTokenExpiresAt.getTime()).toBe(RFC_NOW.getTime() + 8 * 60 * 60 * 1000);
    expect(issued.accessTokenExpiresAt.getTime()).toBe(RFC_NOW.getTime() + 15 * 60 * 1000);
  });

  it('answers one uniform document for unknown address, deactivated account and wrong password', async () => {
    const store = new FakeAdminSessionStore();
    store.accounts.push(operator(), operator({
      id: '00000000-0000-7000-8000-00000000bbbb',
      email: 'former@easyesg.md',
      active: false,
    }));
    const signIn = build(store);

    await expect(signIn.execute(command({ email: 'nobody@easyesg.md' }))).rejects.toBeInstanceOf(
      AdminCredentialInvalidError,
    );
    await expect(signIn.execute(command({ email: 'former@easyesg.md' }))).rejects.toBeInstanceOf(
      AdminCredentialInvalidError,
    );
    await expect(signIn.execute(command({ password: 'Gresit999!' }))).rejects.toBeInstanceOf(
      AdminCredentialInvalidError,
    );
  });

  it('answers factor-invalid only past the credential bar, and the failure still counts', async () => {
    const store = new FakeAdminSessionStore();
    store.accounts.push(operator());

    await expect(build(store).execute(command({ totpCode: '000000' }))).rejects.toBeInstanceOf(
      AdminFactorInvalidError,
    );

    // The counter survived the refusal (the use case commits before it throws) — a lockout
    // that ignored factor failures would hand a known password an unbounded guessing budget.
    expect(store.accounts[0].failedAttempts).toBe(1);
    expect(store.rollbacks).toBe(0);
  });

  it('locks at the threshold and the lock ends the oracle', async () => {
    const store = new FakeAdminSessionStore();
    store.accounts.push(operator({ failedAttempts: 9 }));

    await expect(build(store).execute(command({ password: 'Gresit999!' }))).rejects.toBeInstanceOf(
      AdminCredentialInvalidError,
    );
    expect(store.accounts[0].lockedAt).not.toBeNull();

    // Locked: even the fully correct pair now answers locked, teaching nothing further.
    await expect(build(store).execute(command())).rejects.toBeInstanceOf(AdminAccountLockedError);
  });

  it('throttles the sixth processed attempt in the window, uniformly (§12.5.6)', async () => {
    const store = new FakeAdminSessionStore();
    store.accounts.push(operator());
    const signIn = build(store);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(signIn.execute(command({ password: 'Gresit999!' }))).rejects.toBeInstanceOf(
        AdminCredentialInvalidError,
      );
    }
    await expect(signIn.execute(command())).rejects.toBeInstanceOf(AuthRateLimitedError);
    // The refused attempt was not recorded — a block drains, never rolls (auth-throttle.ts).
    expect(store.attempts).toHaveLength(5);
  });

  it('clears the failure count on full success', async () => {
    const store = new FakeAdminSessionStore();
    store.accounts.push(operator({ failedAttempts: 7 }));

    await build(store).execute(command());

    expect(store.accounts[0].failedAttempts).toBe(0);
  });
});
