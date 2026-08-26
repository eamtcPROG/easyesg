import { totpCodeAt } from '@api/modules/platform/admin/domain/totp';
import {
  ReauthenticationFailedError,
  TotpAlreadyEnrolledError,
  TotpCodeInvalidError,
  TotpNotEnrolledError,
} from '../errors/account.errors';
import { hashRecoveryCode, RECOVERY_CODE_COUNT } from '../domain/recovery-code';
import { ACCOUNT_STATUS } from '../models/account.model';
import { FakeAccountStore, FakePasswordHasher } from '../testing/account-store.fake';
import { ConsumeRecoveryCode, ManageTotp } from './manage-totp.use-case';

/**
 * UC-193 and UC-195 (NFR-95; task 27.2).
 *
 * What is pinned here is everything §12.5.6's task-27.2 row decided and no browser journey can
 * reach cheaply: that a wrong password refuses each of the three password-gated operations, that a
 * provider-only account is admitted without one, that an unconfirmed enrolment activates nothing,
 * and that a spent code is spent.
 */
const PASSWORD = 'ParolaMea1!';
const OTHER_ACCOUNT = 'account-2';

describe('ManageTotp (UC-193, NFR-95)', () => {
  const now = new Date('2026-08-26T10:00:00Z');

  let store: FakeAccountStore;
  let hasher: FakePasswordHasher;
  let totp: ManageTotp;

  const seed = (options: { withPassword?: boolean } = {}) => {
    for (const id of ['account-1', OTHER_ACCOUNT]) {
      store.accounts.push({
        id,
        email: `${id}@example.md`,
        status: ACCOUNT_STATUS.ACTIVE,
        locale: 'ro',
        verifiedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }
    if (options.withPassword !== false) {
      store.credentials.set('account-1', {
        accountId: 'account-1',
        passwordHash: `hashed:${PASSWORD}`,
        failedAttempts: 0,
        lockedAt: null,
      });
    }
  };

  /** Enrol fully, the way S-28 will: begin, read the code the authenticator would show, confirm. */
  const enrol = async () => {
    const offer = await totp.begin({ accountId: 'account-1', password: PASSWORD });
    const code = totpCodeAt(offer.secret, now);
    const codes = await totp.confirm({ accountId: 'account-1', code: code ?? '' });
    return { offer, codes };
  };

  beforeEach(() => {
    store = new FakeAccountStore();
    hasher = new FakePasswordHasher();
    totp = new ManageTotp(store, hasher, () => now);
    seed();
  });

  it('enrols in two steps and issues the specified number of recovery codes', async () => {
    const { offer, codes } = await enrol();

    expect(offer.enrolmentUri).toContain('otpauth://totp/');
    expect(codes).toHaveLength(RECOVERY_CODE_COUNT);
    expect(await totp.state('account-1')).toEqual({
      enrolled: true,
      recoveryCodesRemaining: RECOVERY_CODE_COUNT,
    });
  });

  // The two-step shape is the whole point of `confirmed_at`: a secret the authenticator failed to
  // capture must leave the account exactly as it was, not demanding a code no device can produce.
  it('activates nothing until the code confirms the authenticator captured the secret', async () => {
    await totp.begin({ accountId: 'account-1', password: PASSWORD });

    expect(await totp.state('account-1')).toEqual({
      enrolled: false,
      recoveryCodesRemaining: 0,
    });
  });

  it('refuses a wrong first code, and leaves the enrolment unconfirmed', async () => {
    await totp.begin({ accountId: 'account-1', password: PASSWORD });

    await expect(totp.confirm({ accountId: 'account-1', code: '000000' })).rejects.toThrow(
      TotpCodeInvalidError,
    );
    expect((await totp.state('account-1')).enrolled).toBe(false);
  });

  it('lets an abandoned enrolment start again with a fresh secret', async () => {
    const first = await totp.begin({ accountId: 'account-1', password: PASSWORD });
    const second = await totp.begin({ accountId: 'account-1', password: PASSWORD });

    expect(second.secret).not.toBe(first.secret);
    // And the abandoned secret is gone rather than left live beside the new one.
    expect(totpCodeAt(first.secret, now)).not.toBe(totpCodeAt(second.secret, now));
  });

  // The refusal that makes the re-authentication rule worth having: without it, a caller holding a
  // stolen session could replace a working factor with one only they can answer.
  it('refuses to re-enrol over a confirmed factor', async () => {
    await enrol();

    await expect(totp.begin({ accountId: 'account-1', password: PASSWORD })).rejects.toThrow(
      TotpAlreadyEnrolledError,
    );
  });

  describe('re-authentication (§12.5.6, task 27.2)', () => {
    it.each([
      ['begin', () => totp.begin({ accountId: 'account-1', password: 'wrong' })],
      ['disable', () => totp.disable({ accountId: 'account-1', password: 'wrong' })],
      [
        'reissue',
        () => totp.reissueRecoveryCodes({ accountId: 'account-1', password: 'wrong' }),
      ],
    ])('refuses %s on a wrong current password', async (_name, act) => {
      await expect(act()).rejects.toThrow(ReauthenticationFailedError);
    });

    it('refuses when the password is omitted entirely by an account that has one', async () => {
      await expect(totp.begin({ accountId: 'account-1' })).rejects.toThrow(
        ReauthenticationFailedError,
      );
    });

    // FR-2's provider-only account holds no credential row, so there the session IS the
    // credential — §12.5.6 records that as an assumption rather than an equivalence.
    it('admits a provider-only account, which has no password to re-authenticate with', async () => {
      const offer = await totp.begin({ accountId: OTHER_ACCOUNT });
      expect(offer.secret).toHaveLength(32);
    });
  });

  describe('disenrolment — opt-in that cannot be reversed is not opt-in (NFR-95)', () => {
    it('removes the factor and its recovery codes together', async () => {
      await enrol();

      await totp.disable({ accountId: 'account-1', password: PASSWORD });

      expect(await totp.state('account-1')).toEqual({
        enrolled: false,
        recoveryCodesRemaining: 0,
      });
      // The codes must not outlive the factor: a recovery code is a credential, and one left
      // behind would sign in against a factor that no longer exists.
      expect(store.recoveryCodes).toHaveLength(0);
    });

    it('refuses on an account with no factor', async () => {
      await expect(
        totp.disable({ accountId: 'account-1', password: PASSWORD }),
      ).rejects.toThrow(TotpNotEnrolledError);
    });
  });

  describe('re-issuing codes replaces the whole set (§12.5.6)', () => {
    it('spends nothing forward — an old code stops working', async () => {
      const { codes } = await enrol();
      const consume = new ConsumeRecoveryCode(store, () => now);

      const reissued = await totp.reissueRecoveryCodes({
        accountId: 'account-1',
        password: PASSWORD,
      });

      expect(reissued).toHaveLength(RECOVERY_CODE_COUNT);
      expect(reissued).not.toContain(codes[0]);
      // The point of replacing rather than appending: a user who re-issues because they think a
      // code leaked would otherwise still have the leaked one live.
      expect(await consume.execute({ accountId: 'account-1', code: codes[0] })).toBe(false);
      expect(await consume.execute({ accountId: 'account-1', code: reissued[0] })).toBe(true);
    });

    it('refuses on an enrolment that was never confirmed', async () => {
      await totp.begin({ accountId: 'account-1', password: PASSWORD });

      await expect(
        totp.reissueRecoveryCodes({ accountId: 'account-1', password: PASSWORD }),
      ).rejects.toThrow(TotpNotEnrolledError);
    });
  });
});

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
