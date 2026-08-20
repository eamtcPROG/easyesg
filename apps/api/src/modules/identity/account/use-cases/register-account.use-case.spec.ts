import { EMAIL_VERIFICATION_REQUESTED, type EmailVerificationRequested } from '../constants/account.constants';
import { UNVERIFIED_ACCOUNT_TTL_MS } from '../domain/account-expiry';
import { hashVerificationToken } from '../domain/verification-token';
import { EmailAlreadyRegisteredError, PasswordPolicyViolationError } from '../errors/account.errors';
import { FakeAccountStore, FakePasswordHasher } from '../testing/account-store.fake';
import { RegisterAccount } from './register-account.use-case';

/**
 * UC-01, with no database, no broker and no HTTP — which is the check CLAUDE.md names for whether
 * the layering is right, not an incidental convenience.
 */
describe('RegisterAccount (UC-01, FR-1)', () => {
  const NOW = new Date('2026-08-20T09:00:00.000Z');

  let store: FakeAccountStore;
  let hasher: FakePasswordHasher;
  let registerAccount: RegisterAccount;

  beforeEach(() => {
    store = new FakeAccountStore();
    hasher = new FakePasswordHasher();
    registerAccount = new RegisterAccount(store, hasher, () => NOW);
  });

  const register = (overrides: Partial<{ email: string; password: string }> = {}) =>
    registerAccount.execute({
      email: 'Ana.Popescu@example.md',
      password: 'Parola123!',
      locale: 'ro',
      ...overrides,
    });

  describe('the main success scenario', () => {
    it('creates an unverified account and issues a challenge', async () => {
      const account = await register();

      expect(account.status).toBe('unverified');
      expect(account.verifiedAt).toBeNull();
      expect(store.tokens).toHaveLength(1);
      expect(store.effects).toHaveLength(1);
    });

    // FR-1's postcondition is that nothing is reachable pre-verification, which starts with the
    // record itself saying so rather than with a guard elsewhere remembering to check.
    it('stores the address as typed, so mail is addressed as the user wrote it', async () => {
      const account = await register();
      expect(account.email).toBe('Ana.Popescu@example.md');
    });

    it('persists the negotiated locale, which is what FR-169 later resolves email language from', async () => {
      const account = await registerAccount.execute({
        email: 'ivan@example.md',
        password: 'Parola123!',
        locale: 'ru',
      });
      expect(account.locale).toBe('ru');
    });

    it('hashes the password and never stores it', async () => {
      const account = await register();
      expect(hasher.hashed).toEqual(['Parola123!']);
      expect(store.credentials.get(account.id)).toBe('hashed:Parola123!');
    });
  });

  describe('the outbox effect (AD-6, P-8)', () => {
    it('emits the raw token, which exists nowhere else (OQ-54)', async () => {
      const account = await register();
      const payload = store.effects[0].payload as unknown as EmailVerificationRequested;

      expect(store.effects[0].eventType).toBe(EMAIL_VERIFICATION_REQUESTED);
      expect(payload.email).toBe(account.email);
      expect(payload.locale).toBe('ro');
      // The stored hash must be the hash OF the emitted value — the property that makes the email
      // and the database two views of one token rather than two unrelated secrets.
      expect(store.tokens[0].tokenHash).toEqual(hashVerificationToken(payload.token));
    });

    it('carries a natural idempotency key, so a redelivered job sends one email', async () => {
      const account = await register();
      expect(store.effects[0].idempotencyKey).toBe(
        `${EMAIL_VERIFICATION_REQUESTED}:${account.id}:${store.tokens[0].expiresAt.getTime()}`,
      );
    });

    /**
     * The dual write P-8 exists to remove, from the failing side. Without the shared transaction a
     * rejected registration would still have queued an email carrying a working link for an
     * account that does not exist.
     */
    it('leaves no account, no token and no effect when the transaction fails', async () => {
      await register();
      await expect(register()).rejects.toBeInstanceOf(EmailAlreadyRegisteredError);

      expect(store.rollbacks).toBe(1);
      expect(store.accounts).toHaveLength(1);
      expect(store.tokens).toHaveLength(1);
      expect(store.effects).toHaveLength(1);
    });
  });

  describe('a duplicate address (OQ-53)', () => {
    it('is refused', async () => {
      await register();
      await expect(register()).rejects.toBeInstanceOf(EmailAlreadyRegisteredError);
    });

    it('is refused case-insensitively, matching the functional unique index', async () => {
      await register({ email: 'ana.popescu@example.md' });
      await expect(register({ email: 'ANA.POPESCU@EXAMPLE.MD' })).rejects.toBeInstanceOf(
        EmailAlreadyRegisteredError,
      );
    });
  });

  describe('an expired unverified account (OQ-52)', () => {
    /**
     * The reason the pre-read exists at all. Without it a user whose first attempt lapsed would be
     * told the address is taken — by their own dead registration — for the remainder of the week.
     */
    it('is reclaimed, and registration proceeds', async () => {
      const past = new Date(NOW.getTime() - UNVERIFIED_ACCOUNT_TTL_MS - 1);
      // Both clocks move: the use case's, and the one that stamps `created_at`. Expiry is measured
      // from the row's age, so aging only the use case would prove nothing.
      store = new FakeAccountStore(() => past);
      registerAccount = new RegisterAccount(store, hasher, () => NOW);
      const stale = new RegisterAccount(store, hasher, () => past);
      const abandoned = await stale.execute({
        email: 'ana.popescu@example.md',
        password: 'Parola123!',
        locale: 'ro',
      });

      const fresh = await register();

      expect(fresh.id).not.toBe(abandoned.id);
      expect(store.accounts).toHaveLength(1);
      // The abandoned account's token went with it — ON DELETE CASCADE, so an old link cannot
      // verify the new account.
      expect(store.tokens).toHaveLength(1);
      expect(store.tokens[0].accountId).toBe(fresh.id);
    });
  });

  describe('the password policy (OQ-51)', () => {
    it('refuses a password that does not meet it', async () => {
      await expect(register({ password: 'parola' })).rejects.toBeInstanceOf(
        PasswordPolicyViolationError,
      );
    });

    // Checked before anything else so a rejected password costs neither a hash nor a connection —
    // which matters because Argon2id is deliberately expensive and this route is unauthenticated.
    it('refuses it without hashing and without opening a transaction', async () => {
      await expect(register({ password: 'parola' })).rejects.toBeInstanceOf(
        PasswordPolicyViolationError,
      );
      expect(hasher.hashed).toEqual([]);
      expect(store.rollbacks).toBe(0);
      expect(store.accounts).toEqual([]);
    });
  });
});
