import type { EmailVerificationRequested } from '../constants/account.constants';
import { UNVERIFIED_ACCOUNT_TTL_MS } from '../domain/account-expiry';
import { ACCOUNT_SETUP_PROOF_WINDOW_MS } from '../domain/account-setup';
import { hashPasswordResetToken } from '../domain/password-reset-token';
import { VERIFICATION_TOKEN_TTL_MS } from '../domain/verification-token';
import { VerificationTokenInvalidError } from '../errors/account.errors';
import { FakeAccountStore, FakePasswordHasher } from '../testing/account-store.fake';
import { RegisterAccount } from './register-account.use-case';
import { VerifyEmail } from './verify-email.use-case';

/**
 * UC-03. Registration is run for real rather than hand-seeding a token, so the two halves are
 * tested as they actually meet — a token minted by one and presented to the other.
 */
describe('VerifyEmail (UC-03, FR-3)', () => {
  const REGISTERED_AT = new Date('2026-08-20T09:00:00.000Z');

  let store: FakeAccountStore;
  let token: string;

  const verifyAt = (now: Date) => new VerifyEmail(store, () => now);

  beforeEach(async () => {
    store = new FakeAccountStore(() => REGISTERED_AT);
    await new RegisterAccount(store, new FakePasswordHasher(), () => REGISTERED_AT).execute({
      email: 'ana.popescu@example.md',
      password: 'Parola123!',
      givenName: 'Ana',
      familyName: 'Popescu',
      locale: 'ro',
    });
    token = (store.effects[0].payload as unknown as EmailVerificationRequested).token;
  });

  it('activates an account that holds a password, and answers no grant', async () => {
    const at = new Date(REGISTERED_AT.getTime() + 60_000);
    const verified = await verifyAt(at).execute({ token: token });

    expect(verified.account.status).toBe('active');
    expect(verified.account.verifiedAt).toEqual(at);
    expect(verified.setupGrant).toBeNull();
    expect(store.resetTokens).toHaveLength(0);
  });

  it('refuses a token that was never issued', async () => {
    await expect(verifyAt(REGISTERED_AT).execute({ token: 'not-a-token' })).rejects.toBeInstanceOf(
      VerificationTokenInvalidError,
    );
  });

  /**
   * Single use, which the conditional UPDATE in the adapter is what actually enforces. Asserting
   * it here pins the use case's half: it must not re-derive a "was this consumed" test of its own,
   * because a read-then-write version would pass this spec and fail under two simultaneous clicks.
   */
  it('refuses a token that has already been used', async () => {
    const at = new Date(REGISTERED_AT.getTime() + 60_000);
    await verifyAt(at).execute({ token: token });
    await expect(verifyAt(at).execute({ token: token })).rejects.toBeInstanceOf(VerificationTokenInvalidError);
  });

  it('refuses a token past its 24-hour lifetime', async () => {
    const late = new Date(REGISTERED_AT.getTime() + VERIFICATION_TOKEN_TTL_MS + 1);
    await expect(verifyAt(late).execute({ token: token })).rejects.toBeInstanceOf(
      VerificationTokenInvalidError,
    );
  });

  it('accepts a token one millisecond before it lapses', async () => {
    const justInTime = new Date(REGISTERED_AT.getTime() + VERIFICATION_TOKEN_TTL_MS - 1);
    await expect(verifyAt(justInTime).execute({ token: token })).resolves.toMatchObject({
      account: { status: 'active' },
    });
  });

  /**
   * OQ-52's window outliving the token's is what makes this reachable at all: the link is dead
   * after a day and the account after a week, so between them there is a token that is valid in
   * every respect except that its account is not.
   */
  it('refuses a valid token whose account has itself expired', async () => {
    // Re-issued late enough that the token is live and the account is not — which is only
    // constructible because the two windows differ.
    const wayLater = new Date(REGISTERED_AT.getTime() + UNVERIFIED_ACCOUNT_TTL_MS + 1);
    store.tokens[0].expiresAt = new Date(wayLater.getTime() + VERIFICATION_TOKEN_TTL_MS);

    await expect(verifyAt(wayLater).execute({ token: token })).rejects.toBeInstanceOf(
      VerificationTokenInvalidError,
    );
    expect(store.accounts[0].status).toBe('unverified');
  });

  it('leaves the account untouched when it refuses', async () => {
    const late = new Date(REGISTERED_AT.getTime() + VERIFICATION_TOKEN_TTL_MS + 1);
    await expect(verifyAt(late).execute({ token: token })).rejects.toThrow();

    expect(store.accounts[0].status).toBe('unverified');
    expect(store.accounts[0].verifiedAt).toBeNull();
    expect(store.rollbacks).toBe(1);
  });

  /**
   * Task 155 (§12.5.6's task-155 row (4)). A provider registration whose provider did not assert the
   * address holds no password; registration is run for real and its credential removed, which is that
   * account's shape exactly — an unverified row, a live challenge, no credential.
   */
  describe('an account holding no password (task 155)', () => {
    beforeEach(() => {
      store.credentials.delete(store.accounts[0].id);
    });

    it('enters setup with the deadline registration set, and answers a single-use grant good for a quarter-hour', async () => {
      const at = new Date(REGISTERED_AT.getTime() + 60_000);
      const verified = await verifyAt(at).execute({ token: token });

      expect(verified.account.status).toBe('awaiting_setup');
      expect(verified.account.verifiedAt).toEqual(at);
      expect(verified.account.setupExpiresAt).toEqual(
        new Date(REGISTERED_AT.getTime() + UNVERIFIED_ACCOUNT_TTL_MS),
      );

      expect(verified.setupGrant).not.toBeNull();
      expect(store.resetTokens).toHaveLength(1);
      expect(store.resetTokens[0].tokenHash.equals(hashPasswordResetToken(verified.setupGrant ?? ''))).toBe(
        true,
      );
      expect(store.resetTokens[0].expiresAt).toEqual(new Date(at.getTime() + ACCOUNT_SETUP_PROOF_WINDOW_MS));
      expect(verified.setupGrantExpiresAt).toEqual(store.resetTokens[0].expiresAt);
      // A grant, not a reset link: the route that signs its holder in claims nothing else.
      expect(store.resetTokens[0].purpose).toBe('account_setup');
    });

    it('retires an outstanding reset link, so the grant is the one live challenge', async () => {
      store.resetTokens.push({
        accountId: store.accounts[0].id,
        tokenHash: hashPasswordResetToken('an-older-link'),
        expiresAt: new Date(REGISTERED_AT.getTime() + 60 * 60 * 1000),
        consumedAt: null,
        purpose: 'reset',
      });

      await verifyAt(new Date(REGISTERED_AT.getTime() + 60_000)).execute({ token: token });

      expect(store.resetTokens.filter((t) => t.consumedAt === null)).toHaveLength(1);
    });
  });
});
