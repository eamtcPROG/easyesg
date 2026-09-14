import {
  RECOVERY_CODE_COUNT,
  hashRecoveryCode,
} from '@api/modules/identity/account/domain/recovery-code';
import type { PasswordHasher } from '@api/modules/identity/account/interfaces/password-hasher.interface';
import { AdminReauthenticationFailedError } from '../errors/admin-credentials.errors';
import { FakeAdminCredentialStore } from '../testing/admin-credential-store.fake';
import { IssueAdminRecoveryCodes } from './issue-admin-recovery-codes.use-case';
import { ReadAdminCredentials } from './read-admin-credentials.use-case';

/** UC-212 step three (task 144) — ten codes, the whole set replaced, and what A-19 reads back. */
const EARLIER = new Date('2026-09-01T10:00:00Z');
const NOW = new Date('2026-09-14T10:00:00Z');
const PASSWORD = 'Parola123!';

const fakeHasher: PasswordHasher = {
  hash: (password) => Promise.resolve(`hashed:${password}`),
  verify: ({ digest, password }) => Promise.resolve(digest === `hashed:${password}`),
};

const setUp = () => {
  const store = new FakeAdminCredentialStore();
  const operator = store.seedAccount({ passwordHash: `hashed:${PASSWORD}` });
  return {
    store,
    operator,
    issue: new IssueAdminRecoveryCodes(store, fakeHasher, () => NOW),
    read: new ReadAdminCredentials(store),
  };
};

describe('IssueAdminRecoveryCodes (UC-212, task 144)', () => {
  it('issues ten codes, keeps only their digests, and replaces an earlier set whole', async () => {
    const { store, operator, issue } = setUp();
    const colleague = store.seedAccount();
    const earlier = { accountId: operator.id, codeHash: hashRecoveryCode('0123456789ABCDEF'), issuedAt: EARLIER, spentAt: null };
    const theirs = { accountId: colleague.id, codeHash: hashRecoveryCode('FEDCBA9876543210'), issuedAt: EARLIER, spentAt: null };
    store.recoveryCodes = [earlier, theirs];

    const codes = await issue.execute({ accountId: operator.id, password: PASSWORD });

    expect(codes).toHaveLength(RECOVERY_CODE_COUNT);
    const mine = store.recoveryCodes.filter((code) => code.accountId === operator.id);
    expect(mine.map((code) => code.codeHash)).toEqual(codes.map(hashRecoveryCode));
    expect(mine.some((code) => code.codeHash.equals(earlier.codeHash))).toBe(false);
    expect(store.recoveryCodes).toContain(theirs);
  });

  it('reads back when the set was issued and how many remain — and that none was, before the first issue', async () => {
    const { operator, issue, read } = setUp();

    expect(await read.execute({ accountId: operator.id })).toEqual({
      recoveryCodesIssuedAt: null,
      recoveryCodesRemaining: 0,
    });

    await issue.execute({ accountId: operator.id, password: PASSWORD });

    expect(await read.execute({ accountId: operator.id })).toEqual({
      recoveryCodesIssuedAt: NOW,
      recoveryCodesRemaining: RECOVERY_CODE_COUNT,
    });
  });

  it('refuses a wrong password and replaces nothing', async () => {
    const { store, operator, issue } = setUp();
    const earlier = { accountId: operator.id, codeHash: hashRecoveryCode('0123456789ABCDEF'), issuedAt: EARLIER, spentAt: null };
    store.recoveryCodes = [earlier];

    await expect(issue.execute({ accountId: operator.id, password: 'Gresita1!' })).rejects.toBeInstanceOf(
      AdminReauthenticationFailedError,
    );
    expect(store.recoveryCodes).toEqual([earlier]);
  });
});
