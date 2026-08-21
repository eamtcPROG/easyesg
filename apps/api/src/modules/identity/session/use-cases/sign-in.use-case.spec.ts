import { AuthRateLimitedError } from '@api/modules/identity/account/errors/account.errors';
import {
  ACCOUNT_STATUS,
  type Account,
} from '@api/modules/identity/account/models/account.model';
import { FakePasswordHasher } from '@api/modules/identity/account/testing/account-store.fake';
import { ACCESS_TOKEN_TTL_MS, SESSION_IDLE_TTL_MS } from '../domain/session-expiry';
import {
  AccountLockedError,
  CredentialInvalidError,
  EmailUnverifiedError,
} from '../errors/session.errors';
import { FakeAccessTokenSigner, FakeSessionStore } from '../testing/session-store.fake';
import { SignIn } from './sign-in.use-case';

describe('SignIn (UC-04, FR-4)', () => {
  const now = new Date('2026-08-21T10:00:00Z');
  const email = 'Ana.Popescu@example.md';

  let store: FakeSessionStore;
  let hasher: FakePasswordHasher;
  let signer: FakeAccessTokenSigner;
  let signIn: SignIn;

  const account = (overrides: Partial<Account> = {}): Account => ({
    id: 'account-1',
    email,
    status: ACCOUNT_STATUS.ACTIVE,
    locale: 'ro',
    verifiedAt: new Date('2026-08-01T00:00:00Z'),
    createdAt: new Date('2026-08-01T00:00:00Z'),
    updatedAt: new Date('2026-08-01T00:00:00Z'),
    ...overrides,
  });

  const credential = (overrides: Partial<{ failedAttempts: number; lockedAt: Date | null }> = {}) => ({
    passwordHash: 'hashed:Parola123!',
    failedAttempts: 0,
    lockedAt: null,
    ...overrides,
  });

  beforeEach(() => {
    store = new FakeSessionStore();
    hasher = new FakePasswordHasher();
    signer = new FakeAccessTokenSigner();
    signIn = new SignIn(store, hasher, signer, () => now);
  });

  describe('the main success scenario', () => {
    it('issues a session scoped to the account, with honest expiries', async () => {
      store.seedAccount(account(), credential());

      const issued = await signIn.execute({ email, password: 'Parola123!' });

      expect(issued.account.id).toBe('account-1');
      expect(issued.sessionId).toBe(store.sessions[0].id);
      expect(issued.accessTokenExpiresAt.getTime()).toBe(now.getTime() + ACCESS_TOKEN_TTL_MS);
      // Fresh session: the idle bound is the earlier of the two clocks.
      expect(issued.refreshTokenExpiresAt.getTime()).toBe(now.getTime() + SESSION_IDLE_TTL_MS);
      // The raw refresh token reaches the caller; the store holds only a hash of it.
      expect(issued.refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(store.liveTokensFor(issued.sessionId)).toHaveLength(1);
      expect(signer.signed).toEqual([
        { sessionId: issued.sessionId, expiresAt: issued.accessTokenExpiresAt },
      ]);
    });

    it('resets the consecutive-failure count a lockout would be built on', async () => {
      store.seedAccount(account(), credential({ failedAttempts: 7 }));

      await signIn.execute({ email, password: 'Parola123!' });

      expect(store.credentials.get('account-1')?.failedAttempts).toBe(0);
    });
  });

  describe('the uniform refusal (NFR-64)', () => {
    it('answers identically for an unknown address and a wrong password', async () => {
      store.seedAccount(account(), credential());

      const unknown = signIn.execute({ email: 'nobody@example.md', password: 'Parola123!' });
      await expect(unknown).rejects.toBeInstanceOf(CredentialInvalidError);

      const wrong = signIn.execute({ email, password: 'Gresita123!' });
      await expect(wrong).rejects.toBeInstanceOf(CredentialInvalidError);
    });

    it('burns a real verification on the unknown-address path, so timing matches', async () => {
      await expect(
        signIn.execute({ email: 'nobody@example.md', password: 'Parola123!' }),
      ).rejects.toBeInstanceOf(CredentialInvalidError);

      // One verify happened — against the dummy digest, since no credential exists.
      expect(hasher.verified).toHaveLength(1);
    });

    it('treats an unverified account past its 7-day window as no account (OQ-52)', async () => {
      store.seedAccount(
        account({
          status: ACCOUNT_STATUS.UNVERIFIED,
          verifiedAt: null,
          createdAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000),
        }),
        credential(),
      );

      await expect(signIn.execute({ email, password: 'Parola123!' })).rejects.toBeInstanceOf(
        CredentialInvalidError,
      );
      expect(store.credentials.get('account-1')?.failedAttempts).toBe(0);
    });
  });

  describe('the failure counters (FR-4) — durable although the request fails', () => {
    it('a wrong password counts, and the count survives the thrown refusal', async () => {
      store.seedAccount(account(), credential({ failedAttempts: 3 }));

      await expect(signIn.execute({ email, password: 'Gresita123!' })).rejects.toBeInstanceOf(
        CredentialInvalidError,
      );

      expect(store.credentials.get('account-1')?.failedAttempts).toBe(4);
      // The commit-then-throw shape: nothing rolled back on the way out.
      expect(store.rollbacks).toBe(0);
    });

    it('the tenth consecutive failure locks (§12.5.6)', async () => {
      store.seedAccount(account(), credential({ failedAttempts: 9 }));

      await expect(signIn.execute({ email, password: 'Gresita123!' })).rejects.toBeInstanceOf(
        CredentialInvalidError,
      );

      const locked = store.credentials.get('account-1');
      expect(locked?.failedAttempts).toBe(10);
      expect(locked?.lockedAt).toEqual(now);
    });

    it('a locked credential refuses without verifying — correct password included', async () => {
      store.seedAccount(account(), credential({ failedAttempts: 10, lockedAt: now }));

      await expect(signIn.execute({ email, password: 'Parola123!' })).rejects.toBeInstanceOf(
        AccountLockedError,
      );
      expect(hasher.verified).toHaveLength(0);
    });
  });

  describe('the unverified account (OQ-57)', () => {
    const unverified = () =>
      account({ status: ACCOUNT_STATUS.UNVERIFIED, verifiedAt: null, createdAt: now });

    it('names verification only when the password is correct', async () => {
      store.seedAccount(unverified(), credential({ failedAttempts: 2 }));

      await expect(signIn.execute({ email, password: 'Parola123!' })).rejects.toBeInstanceOf(
        EmailUnverifiedError,
      );
      // A correct password ends the consecutive run the lockout counts.
      expect(store.credentials.get('account-1')?.failedAttempts).toBe(0);
    });

    it('stays inside the uniform refusal when the password is wrong, and still counts', async () => {
      store.seedAccount(unverified(), credential());

      await expect(signIn.execute({ email, password: 'Gresita123!' })).rejects.toBeInstanceOf(
        CredentialInvalidError,
      );
      expect(store.credentials.get('account-1')?.failedAttempts).toBe(1);
    });
  });

  describe('the throttle window (§12.5.6)', () => {
    it('refuses the sixth attempt in the window, and does not record the refusal', async () => {
      store.seedAccount(account(), credential());
      for (let i = 0; i < 5; i += 1) {
        await expect(signIn.execute({ email, password: 'Gresita123!' })).rejects.toBeInstanceOf(
          CredentialInvalidError,
        );
      }
      expect(store.attempts).toHaveLength(5);

      await expect(signIn.execute({ email, password: 'Parola123!' })).rejects.toBeInstanceOf(
        AuthRateLimitedError,
      );
      // Not recorded: the block drains 15 minutes after the fifth PROCESSED attempt.
      expect(store.attempts).toHaveLength(5);
    });

    it('keys per address — another account is not throttled by a neighbour', async () => {
      store.seedAccount(account(), credential());
      store.seedAccount(
        account({ id: 'account-2', email: 'ion.rusu@example.md' }),
        credential(),
      );
      for (let i = 0; i < 5; i += 1) {
        await expect(signIn.execute({ email, password: 'Gresita123!' })).rejects.toBeInstanceOf(
          CredentialInvalidError,
        );
      }

      const issued = await signIn.execute({ email: 'ion.rusu@example.md', password: 'Parola123!' });
      expect(issued.account.id).toBe('account-2');
    });
  });
});
