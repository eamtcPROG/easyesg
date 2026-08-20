import type { EmailVerificationRequested } from '../constants/account.constants';
import { UNVERIFIED_ACCOUNT_TTL_MS } from '../domain/account-expiry';
import { hashVerificationToken } from '../domain/verification-token';
import { FakeAccountStore, FakePasswordHasher } from '../testing/account-store.fake';
import { RegisterAccount } from './register-account.use-case';
import { ResendVerificationEmail } from './resend-verification-email.use-case';
import { VerifyEmail } from './verify-email.use-case';

/**
 * OQ-55, closed 20 Aug 2026 — the exit from the six-day gap between a dead link and a live account.
 *
 * Most of these assertions are about what the use case does **not** do. That is the requirement:
 * NFR-64 wants a response that is identical whatever the address turns out to be, and the only way
 * to be sure of that is to check each branch separately and find nothing distinguishing them.
 */
describe('ResendVerificationEmail (FR-3, OQ-55)', () => {
  const REGISTERED_AT = new Date('2026-08-20T09:00:00.000Z');
  const LATER = new Date(REGISTERED_AT.getTime() + 25 * 60 * 60 * 1000);

  let store: FakeAccountStore;

  const resendAt = (now: Date) => new ResendVerificationEmail(store, () => now);

  const registerAt = (now: Date, email = 'ana.popescu@example.md') =>
    new RegisterAccount(store, new FakePasswordHasher(), () => now).execute({
      email,
      password: 'Parola123!',
      locale: 'ro',
    });

  beforeEach(() => {
    store = new FakeAccountStore(() => REGISTERED_AT);
  });

  describe('for an unverified account', () => {
    it('issues a fresh challenge', async () => {
      await registerAt(REGISTERED_AT);
      await resendAt(LATER).execute('ana.popescu@example.md');

      expect(store.effects).toHaveLength(2);
      const reissued = store.effects[1].payload as unknown as EmailVerificationRequested;
      const original = store.effects[0].payload as unknown as EmailVerificationRequested;
      expect(reissued.token).not.toBe(original.token);
    });

    // Otherwise every resend widens the window in which some older link, in some older mailbox,
    // still works — and a user who resends three times leaves three live keys to one account.
    it('retires the previous link, leaving exactly one live challenge', async () => {
      await registerAt(REGISTERED_AT);
      const original = (store.effects[0].payload as unknown as EmailVerificationRequested).token;

      await resendAt(LATER).execute('ana.popescu@example.md');

      const live = store.tokens.filter((token) => !token.consumedAt);
      expect(live).toHaveLength(1);
      expect(live[0].tokenHash).not.toEqual(hashVerificationToken(original));
    });

    it('produces a link that actually verifies', async () => {
      await registerAt(REGISTERED_AT);
      await resendAt(LATER).execute('ana.popescu@example.md');
      const reissued = (store.effects[1].payload as unknown as EmailVerificationRequested).token;

      await expect(new VerifyEmail(store, () => LATER).execute(reissued)).resolves.toMatchObject({
        status: 'active',
      });
    });

    it('matches the address case-insensitively', async () => {
      await registerAt(REGISTERED_AT);
      await resendAt(LATER).execute('ANA.POPESCU@EXAMPLE.MD');
      expect(store.effects).toHaveLength(2);
    });
  });

  describe('every other case, indistinguishably', () => {
    it('does nothing for an address that holds no account', async () => {
      await expect(resendAt(LATER).execute('nobody@example.md')).resolves.toBeUndefined();
      expect(store.effects).toEqual([]);
      expect(store.accounts).toEqual([]);
    });

    it('does nothing for an account that is already active', async () => {
      await registerAt(REGISTERED_AT);
      const token = (store.effects[0].payload as unknown as EmailVerificationRequested).token;
      // Inside the link's 24 h, unlike LATER — verifying with a lapsed link would throw, and the
      // spec would then be asserting about an account that is still unverified.
      const verifiedAt = new Date(REGISTERED_AT.getTime() + 60_000);
      await new VerifyEmail(store, () => verifiedAt).execute(token);

      await expect(resendAt(LATER).execute('ana.popescu@example.md')).resolves.toBeUndefined();
      expect(store.effects).toHaveLength(1);
    });

    // Reissuing here would extend by the back door a deadline OQ-52 set deliberately.
    it('does not revive an account past its seven-day window', async () => {
      await registerAt(REGISTERED_AT);
      const wayLater = new Date(REGISTERED_AT.getTime() + UNVERIFIED_ACCOUNT_TTL_MS + 1);

      await expect(resendAt(wayLater).execute('ana.popescu@example.md')).resolves.toBeUndefined();
      expect(store.effects).toHaveLength(1);
    });

    it('never creates an account', async () => {
      await resendAt(LATER).execute('nobody@example.md');
      expect(store.accounts).toEqual([]);
    });
  });
});
