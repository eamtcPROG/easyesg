import { hashRecoveryCode } from '../domain/recovery-code';
import { FakeAccountStore } from '../testing/account-store.fake';
import { ConsumeRecoveryCode } from './consume-recovery-code.use-case';

/**
 * UC-195 (NFR-95; task 27.2) — that a spent code is spent, and that a refusal says nothing about why.
 * Moved from `manage-totp.use-case.spec.ts` with the class it tests (task 133.1), cases unchanged.
 */
const OTHER_ACCOUNT = 'account-2';

describe('ConsumeRecoveryCode (UC-195)', () => {
  const now = new Date('2026-08-26T10:00:00Z');
  let store: FakeAccountStore;
  let consume: ConsumeRecoveryCode;

  beforeEach(() => {
    store = new FakeAccountStore();
    consume = new ConsumeRecoveryCode(store, () => now);
    store.recoveryCodes.push(
      { accountId: 'account-1', codeHash: hashRecoveryCode('0123456789ABCDEF'), spentAt: null },
      { accountId: OTHER_ACCOUNT, codeHash: hashRecoveryCode('FEDCBA9876543210'), spentAt: null },
    );
  });

  it('spends a code once and refuses it thereafter', async () => {
    expect(await consume.execute({ accountId: 'account-1', code: '0123456789ABCDEF' })).toBe(true);
    expect(await consume.execute({ accountId: 'account-1', code: '0123456789ABCDEF' })).toBe(false);
  });

  it('accepts the code as printed and as retyped', async () => {
    // Grouped, lower case, and with the letter O where a zero was printed — the three things a
    // person does when copying from paper.
    expect(
      await consume.execute({ accountId: 'account-1', code: 'o123-4567-89ab-cdef' }),
    ).toBe(true);
  });

  it('refuses a code belonging to a different account', async () => {
    // Scoped by account as well as by hash: the codes are unique, but a lookup by hash alone
    // would make one account's code a credential against another's if two ever collided.
    expect(await consume.execute({ accountId: 'account-1', code: 'FEDCBA9876543210' })).toBe(false);
    expect(store.recoveryCodes[1].spentAt).toBeNull();
  });

  it('refuses an unrecognised code without disclosing that it is unrecognised', async () => {
    // Both refusals answer `false` — NFR-64's uniform response. The store knows the difference
    // and keeps it; the caller cannot tell a spent code from one that never existed.
    expect(await consume.execute({ accountId: 'account-1', code: 'ZZZZZZZZZZZZZZZZ' })).toBe(false);
  });
});
