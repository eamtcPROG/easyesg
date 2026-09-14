import {
  AUTH_ATTEMPT_LIMIT,
  LOCKOUT_THRESHOLD,
} from '@api/modules/identity/account/domain/auth-throttle';
import { hashRecoveryCode } from '@api/modules/identity/account/domain/recovery-code';
import { AuthRateLimitedError } from '@api/modules/identity/account/errors/account.errors';
import type { PasswordHasher } from '@api/modules/identity/account/interfaces/password-hasher.interface';
import {
  AUDIT_ACTION,
  auditSubject,
} from '@api/modules/platform/audit/models/audit-action.model';
import { AdminRecoveryRefusedError } from '../errors/admin-session.errors';
import type { AdminTokens } from '../interfaces/admin-token.interface';
import { ADMIN_ACCOUNT_STATUS, ADMIN_ROLE, type AdminAccount } from '../models/admin-session.model';
import { FakeAdminSessionStore, FakeSystemAuditLog } from '../testing/admin-session-store.fake';
import { RecoverAdminSignIn } from './recover-admin-sign-in.use-case';

/**
 * UC-212's way back in (task 144) — a sign-in with the password and one recovery code, for a lost
 * authenticator or a locked account. What is pinned here is the ordering the design rests on: the code is
 * judged before the password, so a lock still ends password guessing.
 */
const NOW = new Date('2026-09-14T10:00:00Z');
const PASSWORD = 'Parola123!';
const CODE = '0123456789ABCDEF';
const OTHER_CODE = 'FEDCBA9876543210';

const fakeTokens: AdminTokens = {
  sign: (sessionId, expiresAt) => Promise.resolve(`admin-token:${sessionId}:${expiresAt.getTime()}`),
  verify: () => Promise.resolve(null),
  cookieKey: () => Buffer.alloc(32),
};

/** A hasher that records every digest it was asked about — whether a password was judged at all. */
const countingHasher = () => {
  const verified: string[] = [];
  const hasher: PasswordHasher = {
    hash: (password) => Promise.resolve(`hashed:${password}`),
    verify: ({ digest, password }) => {
      verified.push(digest);
      return Promise.resolve(digest === `hashed:${password}`);
    },
  };
  return { hasher, verified };
};

const operator = (overrides: Partial<AdminAccount> = {}): AdminAccount => ({
  id: '00000000-0000-7000-8000-00000000aaaa',
  email: 'operator@easyesg.md',
  role: ADMIN_ROLE.BILLING_OPERATOR,
  status: ADMIN_ACCOUNT_STATUS.ACTIVE,
  passwordHash: `hashed:${PASSWORD}`,
  totpSecret: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',
  failedAttempts: 0,
  lockedAt: null,
  createdAt: new Date('2026-08-01T00:00:00Z'),
  ...overrides,
});

const setUp = (account: AdminAccount = operator()) => {
  const store = new FakeAdminSessionStore();
  store.accounts.push(account);
  store.recoveryCodes.push(
    { accountId: account.id, codeHash: hashRecoveryCode(CODE), spentAt: null },
    { accountId: account.id, codeHash: hashRecoveryCode(OTHER_CODE), spentAt: null },
  );
  const audit = new FakeSystemAuditLog();
  const { hasher, verified } = countingHasher();
  const recover = new RecoverAdminSignIn(store, hasher, fakeTokens, audit, () => NOW);
  return { store, audit, verified, recover, account };
};

describe('RecoverAdminSignIn (UC-212, task 144)', () => {
  it('signs in with the password and an unused code, spends it, and says how many remain', async () => {
    const { store, audit, recover, account } = setUp();

    const recovered = await recover.execute({ email: account.email, password: PASSWORD, recoveryCode: CODE });

    expect(recovered.identity).toEqual({ id: account.id, email: account.email, role: account.role });
    expect(recovered.recoveryCodesRemaining).toBe(1);
    expect(store.sessions).toHaveLength(1);
    expect(store.recoveryCodes[0].spentAt).toEqual(NOW);
    expect(store.recoveryCodes[1].spentAt).toBeNull();
    expect(audit.recorded).toEqual([
      { action: AUDIT_ACTION.ADMIN_SIGN_IN_RECOVERED, actorId: account.id, subject: auditSubject(account.email) },
    ]);
  });

  it('accepts the code as printed and the address in any case', async () => {
    const { recover, account } = setUp();

    await expect(
      recover.execute({ email: ' Operator@EasyESG.md ', password: PASSWORD, recoveryCode: 'o123-4567-89ab-cdef' }),
    ).resolves.toMatchObject({ recoveryCodesRemaining: 1, identity: { id: account.id } });
  });

  it('admits a locked account, releasing the lock and clearing the failure count', async () => {
    const { store, recover, account } = setUp(
      operator({ lockedAt: new Date('2026-09-14T09:00:00Z'), failedAttempts: LOCKOUT_THRESHOLD }),
    );

    await recover.execute({ email: account.email, password: PASSWORD, recoveryCode: CODE });

    expect(store.accounts[0]).toMatchObject({ lockedAt: null, failedAttempts: 0 });
  });

  it('consumes a code exactly once — a second sign-in with it is refused', async () => {
    const { recover, account } = setUp();

    await recover.execute({ email: account.email, password: PASSWORD, recoveryCode: CODE });

    await expect(
      recover.execute({ email: account.email, password: PASSWORD, recoveryCode: CODE }),
    ).rejects.toBeInstanceOf(AdminRecoveryRefusedError);
  });

  it('judges the code before the password: with no valid code, no password is verified — locked or not', async () => {
    const unlocked = setUp();
    await expect(
      unlocked.recover.execute({ email: unlocked.account.email, password: PASSWORD, recoveryCode: 'ZZZZZZZZZZZZZZZZ' }),
    ).rejects.toBeInstanceOf(AdminRecoveryRefusedError);
    expect(unlocked.verified).toEqual([]);

    const locked = setUp(operator({ lockedAt: NOW, failedAttempts: LOCKOUT_THRESHOLD }));
    await expect(
      locked.recover.execute({ email: locked.account.email, password: PASSWORD, recoveryCode: 'ZZZZZZZZZZZZZZZZ' }),
    ).rejects.toBeInstanceOf(AdminRecoveryRefusedError);
    expect(locked.verified).toEqual([]);
    expect(locked.store.accounts[0].lockedAt).toEqual(NOW);
  });

  it('refuses a wrong password alike, spends no code, and counts the failure toward the lock', async () => {
    const { store, audit, recover, account } = setUp();

    await expect(
      recover.execute({ email: account.email, password: 'Gresita1!', recoveryCode: CODE }),
    ).rejects.toBeInstanceOf(AdminRecoveryRefusedError);

    expect(store.recoveryCodes[0].spentAt).toBeNull();
    expect(store.sessions).toHaveLength(0);
    expect(store.accounts[0].failedAttempts).toBe(1);
    expect(audit.recorded).toEqual([
      { action: AUDIT_ACTION.ADMIN_SIGN_IN_RECOVERY_REFUSED, actorId: account.id, subject: auditSubject(account.email) },
    ]);
  });

  it('refuses an unknown address and a suspended operator as it refuses a wrong code, attributed to nobody', async () => {
    const unknown = setUp();
    await expect(
      unknown.recover.execute({ email: 'nimeni@easyesg.md', password: PASSWORD, recoveryCode: CODE }),
    ).rejects.toBeInstanceOf(AdminRecoveryRefusedError);
    expect(unknown.audit.recorded).toEqual([
      { action: AUDIT_ACTION.ADMIN_SIGN_IN_RECOVERY_REFUSED, actorId: null, subject: auditSubject('nimeni@easyesg.md') },
    ]);

    const suspended = setUp(operator({ status: ADMIN_ACCOUNT_STATUS.SUSPENDED }));
    await expect(
      suspended.recover.execute({ email: suspended.account.email, password: PASSWORD, recoveryCode: CODE }),
    ).rejects.toBeInstanceOf(AdminRecoveryRefusedError);
    expect(suspended.store.recoveryCodes[0].spentAt).toBeNull();
  });

  it('bounds attempts per address with a window of its own, and records the refusal it throttles', async () => {
    const { audit, recover, account } = setUp();

    for (let guess = 0; guess < AUTH_ATTEMPT_LIMIT; guess += 1) {
      await expect(
        recover.execute({ email: account.email, password: PASSWORD, recoveryCode: 'ZZZZZZZZZZZZZZZZ' }),
      ).rejects.toBeInstanceOf(AdminRecoveryRefusedError);
    }
    await expect(
      recover.execute({ email: account.email, password: PASSWORD, recoveryCode: CODE }),
    ).rejects.toBeInstanceOf(AuthRateLimitedError);
    expect(audit.actions.at(-1)).toBe(AUDIT_ACTION.ADMIN_SIGN_IN_THROTTLED);
  });
});
