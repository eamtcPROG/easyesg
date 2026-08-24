import { AuthRateLimitedError } from '@api/modules/identity/account/errors/account.errors';
import type { PasswordHasher } from '@api/modules/identity/account/interfaces/password-hasher.interface';
import {
  AdminAccountLockedError,
  AdminCredentialInvalidError,
} from '../errors/admin-session.errors';
import { ADMIN_ROLE, type AdminAccount } from '../models/admin-session.model';
import { FakeAdminSessionStore } from '../testing/admin-session-store.fake';
import { BeginAdminSignIn } from './begin-admin-sign-in.use-case';

/** UC-68 step one — the credential half of the retired one-shot matrix, semantics unchanged. */
const NOW = new Date('2026-08-24T12:00:00Z');

const fakeHasher: PasswordHasher = {
  hash: (password) => Promise.resolve(`hashed:${password}`),
  verify: ({ digest, password }) => Promise.resolve(digest === `hashed:${password}`),
};

const operator = (overrides: Partial<AdminAccount> = {}): AdminAccount => ({
  id: '00000000-0000-7000-8000-00000000aaaa',
  email: 'operator@easyesg.md',
  role: ADMIN_ROLE.PLATFORM_ADMINISTRATOR,
  active: true,
  passwordHash: 'hashed:Parola123!',
  totpSecret: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',
  failedAttempts: 0,
  lockedAt: null,
  createdAt: new Date('2026-08-01T00:00:00Z'),
  ...overrides,
});

const command = (overrides: Partial<{ email: string; password: string }> = {}) => ({
  email: 'operator@easyesg.md',
  password: 'Parola123!',
  ...overrides,
});

const build = (store: FakeAdminSessionStore) => new BeginAdminSignIn(store, fakeHasher, () => NOW);

describe('BeginAdminSignIn (UC-68 step one, FR-75)', () => {
  it('opens the challenge for a correct credential — and issues NOTHING else', async () => {
    const store = new FakeAdminSessionStore();
    store.accounts.push(operator());

    const challenge = await build(store).execute(command());

    expect(challenge).toEqual({
      identity: {
        id: operator().id,
        email: 'operator@easyesg.md',
        role: ADMIN_ROLE.PLATFORM_ADMINISTRATOR,
      },
      issuedAt: NOW,
    });
    // No session, no token: the factor still stands between the password and the console.
    expect(store.sessions).toHaveLength(0);
    expect(store.refreshTokens).toHaveLength(0);
  });

  it('does not clear the failure count — only the completed pair does', async () => {
    const store = new FakeAdminSessionStore();
    store.accounts.push(operator({ failedAttempts: 7 }));

    await build(store).execute(command());

    // A verified password ends nothing FR-4's threshold counts: the factor behind it may
    // still be under attack, and step two owns the clear.
    expect(store.accounts[0].failedAttempts).toBe(7);
  });

  it('answers one uniform document for unknown address, deactivated account and wrong password', async () => {
    const store = new FakeAdminSessionStore();
    store.accounts.push(
      operator(),
      operator({
        id: '00000000-0000-7000-8000-00000000bbbb',
        email: 'former@easyesg.md',
        active: false,
      }),
    );
    const begin = build(store);

    await expect(begin.execute(command({ email: 'nobody@easyesg.md' }))).rejects.toBeInstanceOf(
      AdminCredentialInvalidError,
    );
    await expect(begin.execute(command({ email: 'former@easyesg.md' }))).rejects.toBeInstanceOf(
      AdminCredentialInvalidError,
    );
    await expect(begin.execute(command({ password: 'Gresit999!' }))).rejects.toBeInstanceOf(
      AdminCredentialInvalidError,
    );
  });

  it('locks at the threshold and the lock ends the oracle', async () => {
    const store = new FakeAdminSessionStore();
    store.accounts.push(operator({ failedAttempts: 9 }));

    await expect(build(store).execute(command({ password: 'Gresit999!' }))).rejects.toBeInstanceOf(
      AdminCredentialInvalidError,
    );
    expect(store.accounts[0].lockedAt).not.toBeNull();

    await expect(build(store).execute(command())).rejects.toBeInstanceOf(AdminAccountLockedError);
  });

  it('throttles the sixth processed attempt in the window, uniformly (§12.5.6)', async () => {
    const store = new FakeAdminSessionStore();
    store.accounts.push(operator());
    const begin = build(store);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(begin.execute(command({ password: 'Gresit999!' }))).rejects.toBeInstanceOf(
        AdminCredentialInvalidError,
      );
    }
    await expect(begin.execute(command())).rejects.toBeInstanceOf(AuthRateLimitedError);
    // The refused attempt was not recorded — a block drains, never rolls (auth-throttle.ts).
    expect(store.attempts).toHaveLength(5);
  });

  it('the counters survive the refusal — the use case commits before it throws', async () => {
    const store = new FakeAdminSessionStore();
    store.accounts.push(operator());

    await expect(build(store).execute(command({ password: 'Gresit999!' }))).rejects.toBeInstanceOf(
      AdminCredentialInvalidError,
    );
    expect(store.accounts[0].failedAttempts).toBe(1);
    expect(store.rollbacks).toBe(0);
  });
});
