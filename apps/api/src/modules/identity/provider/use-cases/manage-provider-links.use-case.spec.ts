import { SOCIAL_PROVIDER, type SocialProvider } from '@api/contracts/identity-provider.port';
import {
  AuthRateLimitedError,
  ReauthenticationFailedError,
} from '@api/modules/identity/account/errors/account.errors';
import { FakePasswordHasher } from '@api/modules/identity/account/testing/account-store.fake';
import { ACCOUNT_STATUS, type Account } from '@api/modules/identity/account/models/account.model';
import {
  LastCredentialError,
  ProviderIdentityTakenError,
  ProviderNotLinkedError,
} from '../errors/social.errors';
import { FakeSocialSignInStore } from '../testing/social-sign-in-store.fake';
import {
  FakeIdentityProviderPort,
  FakeSocialProviderCatalog,
  fakeSettings,
} from '../testing/social-provider.fakes';
import { ManageProviderLinks } from './manage-provider-links.use-case';

/**
 * UC-11 and UC-12 (FR-8; task 27.6).
 *
 * The two business rules are what this pins, and both are one-line rules whose failure modes are
 * account takeover and unrecoverable accounts respectively. **BR-ID-3** — a provider assertion
 * alone never attaches — is structural here rather than asserted: the use case cannot be reached
 * without an `accountId`, which `AuthGuard` resolved from a session. What IS asserted is the half
 * a stolen session would exploit: the re-authentication that keeps an attacker from attaching
 * their own provider and surviving the owner's password change.
 */
const { GOOGLE, MICROSOFT } = SOCIAL_PROVIDER;
const PASSWORD = 'ParolaMea1!';
const WITH_PASSWORD = 'account-1';
const PROVIDER_ONLY = 'account-2';

describe('ManageProviderLinks (UC-11, UC-12, FR-8)', () => {
  const now = new Date('2026-08-27T10:00:00Z');

  let store: FakeSocialSignInStore;

  const REDIRECT = 'http://localhost:3100/auth/social/google/callback';

  /** The OAuth half of a link, identical to a sign-in's — task 24's sealed transaction values. */
  const exchange = (provider: SocialProvider = MICROSOFT) => ({
    provider,
    code: 'code-1',
    state: 'state-1',
    nonce: 'nonce-1',
    codeVerifier: 'verifier-1',
    redirectUri: REDIRECT,
  });

  /**
   * A `ManageProviderLinks` whose provider asserts `subject`. Built per test rather than once,
   * because the subject is what the takeover guard turns on and each case needs its own.
   */
  const linksAsserting = (subject: string) =>
    new ManageProviderLinks(
      store,
      new FakeSocialProviderCatalog([
        fakeSettings(GOOGLE, { redirectUris: [REDIRECT] }),
        fakeSettings(MICROSOFT, { redirectUris: [REDIRECT] }),
      ]),
      new FakeIdentityProviderPort({
        code: 'code-1',
        assertion: {
          subject,
          email: 'ana.popescu@example.md',
          emailVerified: true,
          displayName: null,
        },
      }),
      new FakePasswordHasher(),
      () => now,
    );

  const account = (id: string): Account => ({
    id,
    email: `${id}@example.md`,
    status: ACCOUNT_STATUS.ACTIVE,
    locale: 'ro',
    verifiedAt: now,
    createdAt: now,
    updatedAt: now,
  });

  beforeEach(() => {
    store = new FakeSocialSignInStore();

    store.seedAccount(account(WITH_PASSWORD));
    store.seedAccount(account(PROVIDER_ONLY));
    store.passwords.set(WITH_PASSWORD, `hashed:${PASSWORD}`);
    // A provider-only account (FR-2) with one identity: BR-ID-4's most dangerous shape.
    store.seedIdentity({
      id: 'identity-seed',
      accountId: PROVIDER_ONLY,
      provider: GOOGLE,
      subject: 'subject-provider-only',
      assertedEmail: `${PROVIDER_ONLY}@example.md`,
      emailVerifiedAsserted: true,
    });
  });

  describe('linking (UC-11)', () => {
    it('attaches the assertion to the account that asked', async () => {
      const links = linksAsserting('subject-microsoft');
      await links.link({ accountId: WITH_PASSWORD, password: PASSWORD, ...exchange() });

      expect(await links.linked(WITH_PASSWORD)).toEqual([
        expect.objectContaining({ provider: MICROSOFT, subject: 'subject-microsoft' }),
      ]);
    });

    it('refuses without the current password, so a stolen session cannot attach one', async () => {
      // The attack this rule exists for: attach your own provider, and keep access after the
      // owner changes the password they think was the problem.
      const links = linksAsserting('subject-microsoft');
      await expect(
        links.link({ accountId: WITH_PASSWORD, password: 'wrong', ...exchange() }),
      ).rejects.toBeInstanceOf(ReauthenticationFailedError);

      expect(await links.linked(WITH_PASSWORD)).toEqual([]);
    });

    // FR-2's account holds no password row, and there the session stands as the credential —
    // task 27.2's recorded assumption, unchanged. Without this it could never link a second one.
    it('admits a provider-only account, which has no password to supply', async () => {
      const links = linksAsserting('subject-microsoft');
      await links.link({ accountId: PROVIDER_ONLY, ...exchange() });

      expect(await links.linked(PROVIDER_ONLY)).toHaveLength(2);
    });

    it('refuses an identity already attached to another account, without saying whose', async () => {
      // The provider asserts the subject already held by PROVIDER_ONLY — the takeover guard.
      const links = linksAsserting('subject-provider-only');
      await expect(
        links.link({ accountId: WITH_PASSWORD, password: PASSWORD, ...exchange(GOOGLE) }),
      ).rejects.toBeInstanceOf(ProviderIdentityTakenError);
    });

    it('refuses a second identity for a provider the account already holds', async () => {
      // `UNIQUE (account_id, provider)` — one identity per provider per account. The refusal is
      // the same one, deliberately: the caller can do nothing differently either way.
      const links = linksAsserting('a-different-google');
      await expect(
        links.link({ accountId: PROVIDER_ONLY, ...exchange(GOOGLE) }),
      ).rejects.toBeInstanceOf(ProviderIdentityTakenError);
    });

    it('throttles re-authentication on the shared key (§12.5.6)', async () => {
      const links = linksAsserting('subject-microsoft');
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await expect(
          links.link({ accountId: WITH_PASSWORD, password: 'wrong', ...exchange() }),
        ).rejects.toBeInstanceOf(ReauthenticationFailedError);
      }

      await expect(
        links.link({ accountId: WITH_PASSWORD, password: PASSWORD, ...exchange() }),
      ).rejects.toBeInstanceOf(AuthRateLimitedError);
    });
  });

  describe('unlinking (UC-12) and BR-ID-4', () => {
    it('removes an identity when a password remains', async () => {
      const links = linksAsserting('subject-microsoft');
      await links.link({ accountId: WITH_PASSWORD, password: PASSWORD, ...exchange() });

      await links.unlink({ accountId: WITH_PASSWORD, password: PASSWORD, provider: MICROSOFT });

      expect(await links.linked(WITH_PASSWORD)).toEqual([]);
    });

    it('removes one of two on a provider-only account', async () => {
      const links = linksAsserting('subject-microsoft');
      await links.link({ accountId: PROVIDER_ONLY, ...exchange() });

      await links.unlink({ accountId: PROVIDER_ONLY, provider: MICROSOFT });

      expect(await links.linked(PROVIDER_ONLY)).toHaveLength(1);
    });

    // The refusal UC-12 exists for. The consequence it prevents is worse than a lockout: the
    // account becomes unrecoverable AND takes its organization memberships down with it.
    it('refuses the last credential, leaving the identity in place', async () => {
      const links = linksAsserting('unused');
      await expect(
        links.unlink({ accountId: PROVIDER_ONLY, provider: GOOGLE }),
      ).rejects.toBeInstanceOf(LastCredentialError);

      expect(await links.linked(PROVIDER_ONLY)).toHaveLength(1);
    });

    it('refuses a provider the account does not hold', async () => {
      const links = linksAsserting('unused');
      await expect(
        links.unlink({ accountId: WITH_PASSWORD, password: PASSWORD, provider: GOOGLE }),
      ).rejects.toBeInstanceOf(ProviderNotLinkedError);
    });

    it('refuses without the current password, so a stolen session cannot strip one', async () => {
      const links = linksAsserting('subject-microsoft');
      await links.link({ accountId: WITH_PASSWORD, password: PASSWORD, ...exchange() });

      await expect(
        links.unlink({ accountId: WITH_PASSWORD, password: 'wrong', provider: MICROSOFT }),
      ).rejects.toBeInstanceOf(ReauthenticationFailedError);
      expect(await links.linked(WITH_PASSWORD)).toHaveLength(1);
    });
  });
});
