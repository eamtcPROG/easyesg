import { AUTH_ATTEMPT_LIMIT } from '@api/modules/identity/account/domain/auth-throttle';
import {
  AuthRateLimitedError,
  PasswordPolicyViolationError,
} from '@api/modules/identity/account/errors/account.errors';
import type { PasswordHasher } from '@api/modules/identity/account/interfaces/password-hasher.interface';
import { AdminReauthenticationFailedError } from '../errors/admin-credentials.errors';
import { AdminSessionInvalidError } from '../errors/admin-session.errors';
import { ADMIN_ACCOUNT_STATUS } from '../models/admin-session.model';
import { FakeAdminCredentialStore } from '../testing/admin-credential-store.fake';
import { ChangeAdminPassword } from './change-admin-password.use-case';

/** UC-212 step one (task 144) — the password, FR-7's election over the realm, and what a refusal costs. */
const NOW = new Date('2026-09-14T10:00:00Z');
const CURRENT = 'Parola123!';
const REPLACEMENT = 'ParolaNoua9?';

const fakeHasher: PasswordHasher = {
  hash: (password) => Promise.resolve(`hashed:${password}`),
  verify: ({ digest, password }) => Promise.resolve(digest === `hashed:${password}`),
};

const setUp = () => {
  const store = new FakeAdminCredentialStore();
  const operator = store.seedAccount({ passwordHash: `hashed:${CURRENT}` });
  const current = store.seedSession({ accountId: operator.id });
  return { store, operator, current, change: new ChangeAdminPassword(store, fakeHasher, () => NOW) };
};

describe('ChangeAdminPassword (UC-212, task 144)', () => {
  it('replaces the password and, when asked, ends the other live sessions — never the one asking', async () => {
    const { store, operator, current, change } = setUp();
    const other = store.seedSession({ accountId: operator.id });
    const ended = store.seedSession({
      accountId: operator.id,
      revokedAt: new Date('2026-09-13T10:00:00Z'),
      revokedReason: 'signed_out',
    });
    const someoneElses = store.seedSession({ accountId: store.seedAccount().id });

    const changed = await change.execute({
      accountId: operator.id,
      sessionId: current.id,
      currentPassword: CURRENT,
      password: REPLACEMENT,
      terminateOtherSessions: true,
    });

    expect(changed).toEqual({ otherSessionsTerminated: 1 });
    expect(store.accountById(operator.id)?.passwordHash).toBe(`hashed:${REPLACEMENT}`);
    const byId = (id: string) => store.sessions.find((session) => session.id === id);
    expect(byId(current.id)).toMatchObject({ revokedAt: null });
    expect(byId(other.id)).toMatchObject({ revokedAt: NOW, revokedReason: 'password_changed' });
    expect(byId(ended.id)).toMatchObject({ revokedReason: 'signed_out' });
    expect(byId(someoneElses.id)).toMatchObject({ revokedAt: null });
  });

  it('ends no session when the election is not made', async () => {
    const { store, operator, current, change } = setUp();
    const other = store.seedSession({ accountId: operator.id });

    const changed = await change.execute({
      accountId: operator.id,
      sessionId: current.id,
      currentPassword: CURRENT,
      password: REPLACEMENT,
    });

    expect(changed).toEqual({ otherSessionsTerminated: 0 });
    expect(store.sessions.find((session) => session.id === other.id)).toMatchObject({ revokedAt: null });
    expect(store.accountById(operator.id)?.passwordHash).toBe(`hashed:${REPLACEMENT}`);
  });

  it('refuses a new password the policy refuses, before it spends an attempt', async () => {
    const { store, operator, current, change } = setUp();

    await expect(
      change.execute({ accountId: operator.id, sessionId: current.id, currentPassword: CURRENT, password: 'scurt' }),
    ).rejects.toBeInstanceOf(PasswordPolicyViolationError);
    expect(store.attempts).toHaveLength(0);
  });

  it('refuses a wrong current password, spends an attempt, and changes nothing', async () => {
    const { store, operator, current, change } = setUp();

    await expect(
      change.execute({
        accountId: operator.id,
        sessionId: current.id,
        currentPassword: 'Gresita1!',
        password: REPLACEMENT,
      }),
    ).rejects.toBeInstanceOf(AdminReauthenticationFailedError);
    expect(store.attempts).toHaveLength(1);
    expect(store.accountById(operator.id)?.passwordHash).toBe(`hashed:${CURRENT}`);
  });

  it('bounds guessing: once the window is spent, even the right password is refused', async () => {
    const { operator, current, change } = setUp();
    const attempt = (currentPassword: string) =>
      change.execute({ accountId: operator.id, sessionId: current.id, currentPassword, password: REPLACEMENT });

    for (let guess = 0; guess < AUTH_ATTEMPT_LIMIT; guess += 1) {
      await expect(attempt('Gresita1!')).rejects.toBeInstanceOf(AdminReauthenticationFailedError);
    }
    await expect(attempt(CURRENT)).rejects.toBeInstanceOf(AuthRateLimitedError);
  });

  it('answers an operator suspended mid-request as a session that ended', async () => {
    const { store, operator, current, change } = setUp();
    store.accounts = store.accounts.map((account) => ({ ...account, status: ADMIN_ACCOUNT_STATUS.SUSPENDED }));

    await expect(
      change.execute({ accountId: operator.id, sessionId: current.id, currentPassword: CURRENT, password: REPLACEMENT }),
    ).rejects.toBeInstanceOf(AdminSessionInvalidError);
  });
});
