import { AUTH_ATTEMPT_LIMIT } from '@api/modules/identity/account/domain/auth-throttle';
import { hashRecoveryCode } from '@api/modules/identity/account/domain/recovery-code';
import { AuthRateLimitedError } from '@api/modules/identity/account/errors/account.errors';
import type { PasswordHasher } from '@api/modules/identity/account/interfaces/password-hasher.interface';
import {
  AdminReauthenticationFailedError,
  AdminReenrolmentCodeInvalidError,
  AdminReenrolmentMissingError,
} from '../errors/admin-credentials.errors';
import { FakeAdminCredentialStore } from '../testing/admin-credential-store.fake';
import { ConfirmAdminReenrolment } from './confirm-admin-reenrolment.use-case';

/**
 * UC-212 step two, second half (task 144) — the staged factor put in force. TOTP inputs are RFC 6238's own
 * vector with the clock pinned to its T, as the sign-in specs do, so the code is judged by real arithmetic.
 */
const STAGED = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const CODE = '287082';
const NOW = new Date(59 * 1000);
const PASSWORD = 'Parola123!';

const fakeHasher: PasswordHasher = {
  hash: (password) => Promise.resolve(`hashed:${password}`),
  verify: ({ digest, password }) => Promise.resolve(digest === `hashed:${password}`),
};

const setUp = (stagedTotpSecret: string | null = STAGED) => {
  const store = new FakeAdminCredentialStore();
  const operator = store.seedAccount({ passwordHash: `hashed:${PASSWORD}`, stagedTotpSecret });
  return { store, operator, confirm: new ConfirmAdminReenrolment(store, fakeHasher, () => NOW) };
};

describe('ConfirmAdminReenrolment (UC-212, task 144)', () => {
  it('puts the staged secret in force on a current code, and clears the staging', async () => {
    const { store, operator, confirm } = setUp();

    await confirm.execute({ accountId: operator.id, password: PASSWORD, code: CODE });

    expect(store.accountById(operator.id)).toMatchObject({ totpSecret: STAGED, stagedTotpSecret: null });
  });

  it('refuses a code that is not current, leaving the factor in force and the staging as they were', async () => {
    const { store, operator, confirm } = setUp();

    await expect(
      confirm.execute({ accountId: operator.id, password: PASSWORD, code: '000000' }),
    ).rejects.toBeInstanceOf(AdminReenrolmentCodeInvalidError);
    expect(store.accountById(operator.id)).toMatchObject({
      totpSecret: operator.totpSecret,
      stagedTotpSecret: STAGED,
    });
  });

  it('refuses when nothing is staged', async () => {
    const { operator, confirm } = setUp(null);

    await expect(
      confirm.execute({ accountId: operator.id, password: PASSWORD, code: CODE }),
    ).rejects.toBeInstanceOf(AdminReenrolmentMissingError);
  });

  it('refuses a correct code without the current password — a stolen session alone never completes one', async () => {
    const { store, operator, confirm } = setUp();

    await expect(
      confirm.execute({ accountId: operator.id, password: 'Gresita1!', code: CODE }),
    ).rejects.toBeInstanceOf(AdminReauthenticationFailedError);
    expect(store.accountById(operator.id)?.totpSecret).toBe(operator.totpSecret);
  });

  it('spends one window for wrong codes as for wrong passwords, so guessing a code is bounded too', async () => {
    const { operator, confirm } = setUp();

    for (let guess = 0; guess < AUTH_ATTEMPT_LIMIT; guess += 1) {
      await expect(
        confirm.execute({ accountId: operator.id, password: PASSWORD, code: '000000' }),
      ).rejects.toBeInstanceOf(AdminReenrolmentCodeInvalidError);
    }
    await expect(
      confirm.execute({ accountId: operator.id, password: PASSWORD, code: CODE }),
    ).rejects.toBeInstanceOf(AuthRateLimitedError);
  });

  it('leaves the recovery codes as they are — they belong to the account, not the device', async () => {
    const { store, operator, confirm } = setUp();
    const code = { accountId: operator.id, codeHash: hashRecoveryCode('0123456789ABCDEF'), issuedAt: NOW, spentAt: null };
    store.recoveryCodes = [code];

    await confirm.execute({ accountId: operator.id, password: PASSWORD, code: CODE });

    expect(store.recoveryCodes).toEqual([code]);
  });
});
