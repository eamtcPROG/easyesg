import { AuthRateLimitedError } from '@api/modules/identity/account/errors/account.errors';
import {
  ACCOUNT_STATUS,
  type Account,
} from '@api/modules/identity/account/models/account.model';
import { FakeAccessTokenSigner } from '@api/modules/identity/session/testing/session-store.fake';
import {
  SOCIAL_PROVIDER,
  type ProviderAssertion,
} from '@api/contracts/identity-provider.port';
import {
  SocialEmailInUseError,
  SocialEmailUnverifiedError,
  SocialIdentityUnknownError,
  SocialProviderUnavailableError,
} from '../errors/social.errors';
import { SOCIAL_SIGN_IN_INTENT } from '../models/provider-identity.model';
import { FakeSocialSignInStore } from '../testing/social-sign-in-store.fake';
import {
  FakeIdentityProviderPort,
  FakeSocialProviderCatalog,
  fakeSettings,
} from '../testing/social-provider.fakes';
import { CompleteSocialSignIn, type CompleteSocialSignInCommand } from './complete-social-sign-in.use-case';

describe('CompleteSocialSignIn (UC-02, UC-05; FR-2, FR-4)', () => {
  const now = new Date('2026-08-24T10:00:00Z');
  const redirectUri = 'https://app.example/auth/social/google/callback';

  const assertion = (overrides: Partial<ProviderAssertion> = {}): ProviderAssertion => ({
    subject: 'google-subject-1',
    email: 'Ana.Popescu@example.md',
    emailVerified: true,
    displayName: 'Ana Popescu',
    ...overrides,
  });

  const account = (overrides: Partial<Account> = {}): Account => ({
    id: 'account-1',
    email: 'Ana.Popescu@example.md',
    status: ACCOUNT_STATUS.ACTIVE,
    locale: 'ro',
    verifiedAt: new Date('2026-08-01T00:00:00Z'),
    createdAt: new Date('2026-08-01T00:00:00Z'),
    updatedAt: new Date('2026-08-01T00:00:00Z'),
    ...overrides,
  });

  const command = (
    overrides: Partial<CompleteSocialSignInCommand> = {},
  ): CompleteSocialSignInCommand => ({
    provider: SOCIAL_PROVIDER.GOOGLE,
    code: 'code-1',
    state: 'state-1',
    nonce: 'nonce-1',
    codeVerifier: 'verifier-1',
    redirectUri,
    intent: SOCIAL_SIGN_IN_INTENT.SIGN_IN,
    locale: 'ro',
    ...overrides,
  });

  let store: FakeSocialSignInStore;
  let signer: FakeAccessTokenSigner;

  const completeWith = (asserted: ProviderAssertion): CompleteSocialSignIn =>
    new CompleteSocialSignIn(
      new FakeSocialProviderCatalog([fakeSettings(SOCIAL_PROVIDER.GOOGLE)]),
      new FakeIdentityProviderPort({ code: 'code-1', assertion: asserted }),
      store,
      signer,
      () => now,
    );

  beforeEach(() => {
    store = new FakeSocialSignInStore();
    signer = new FakeAccessTokenSigner();
  });

  describe('UC-05 — sign in through a linked identity', () => {
    it('matches on the subject and issues a session identical in shape to a password one', async () => {
      store.seedAccount(account());
      store.seedIdentity({
        id: 'identity-1',
        accountId: 'account-1',
        provider: SOCIAL_PROVIDER.GOOGLE,
        subject: 'google-subject-1',
        assertedEmail: 'Ana.Popescu@example.md',
        emailVerifiedAsserted: true,
      });

      const issued = await completeWith(assertion()).execute(command());

      expect(issued.account.id).toBe('account-1');
      expect(store.sessions).toHaveLength(1);
      expect(issued.refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(signer.signed[0].sessionId).toBe(issued.sessionId);
    });

    it('still matches when the email changed at the provider, and records the drift', async () => {
      store.seedAccount(account());
      store.seedIdentity({
        id: 'identity-1',
        accountId: 'account-1',
        provider: SOCIAL_PROVIDER.GOOGLE,
        subject: 'google-subject-1',
        assertedEmail: 'Ana.Popescu@example.md',
        emailVerifiedAsserted: true,
      });

      const issued = await completeWith(
        assertion({ email: 'ana.noua@example.md' }),
      ).execute(command());

      // The subject resolved the SAME account (UC-05's business rule)…
      expect(issued.account.id).toBe('account-1');
      // …and the drifted assertion was recorded, not resolved.
      expect(store.identities[0].assertedEmail).toBe('ana.noua@example.md');
      expect(store.accounts[0].email).toBe('Ana.Popescu@example.md');
    });

    it('activates a linked unverified account when the provider vouches for its own address', async () => {
      store.seedAccount(account({ status: ACCOUNT_STATUS.UNVERIFIED, verifiedAt: null, createdAt: now }));
      store.seedIdentity({
        id: 'identity-1',
        accountId: 'account-1',
        provider: SOCIAL_PROVIDER.GOOGLE,
        subject: 'google-subject-1',
        assertedEmail: 'Ana.Popescu@example.md',
        emailVerifiedAsserted: false,
      });

      const issued = await completeWith(assertion({ emailVerified: true })).execute(command());

      expect(issued.account.status).toBe(ACCOUNT_STATUS.ACTIVE);
      expect(store.accounts[0].verifiedAt).toEqual(now);
    });

    it('refuses a linked unverified account when the assertion vouches for a DIFFERENT address', async () => {
      store.seedAccount(account({ status: ACCOUNT_STATUS.UNVERIFIED, verifiedAt: null, createdAt: now }));
      store.seedIdentity({
        id: 'identity-1',
        accountId: 'account-1',
        provider: SOCIAL_PROVIDER.GOOGLE,
        subject: 'google-subject-1',
        assertedEmail: 'Ana.Popescu@example.md',
        emailVerifiedAsserted: false,
      });

      await expect(
        completeWith(
          assertion({ email: 'alta.adresa@example.md', emailVerified: true }),
        ).execute(command()),
      ).rejects.toBeInstanceOf(SocialEmailUnverifiedError);
      expect(store.sessions).toHaveLength(0);
      expect(store.accounts[0].status).toBe(ACCOUNT_STATUS.UNVERIFIED);
    });
  });

  describe('UC-02 — register through the provider', () => {
    it('creates an ACTIVE account with the identity as its credential when the address is asserted verified', async () => {
      const issued = await completeWith(assertion()).execute(
        command({ intent: SOCIAL_SIGN_IN_INTENT.REGISTER }),
      );

      expect(issued.account.status).toBe(ACCOUNT_STATUS.ACTIVE);
      expect(issued.account.email).toBe('Ana.Popescu@example.md');
      expect(store.identities).toHaveLength(1);
      expect(store.identities[0].subject).toBe('google-subject-1');
      // UC-03 satisfied by assertion: no verification challenge, no email.
      expect(store.verificationTokens).toHaveLength(0);
      expect(store.effects).toHaveLength(0);
      expect(store.sessions).toHaveLength(1);
    });

    it('creates an UNVERIFIED account plus a committed challenge when the address is not asserted verified', async () => {
      await expect(
        completeWith(assertion({ emailVerified: false })).execute(
          command({ intent: SOCIAL_SIGN_IN_INTENT.REGISTER }),
        ),
      ).rejects.toBeInstanceOf(SocialEmailUnverifiedError);

      // The refusal is thrown AFTER the commit: account, challenge and outbox row all survive —
      // the email the user is about to receive names an account that must exist.
      expect(store.accounts).toHaveLength(1);
      expect(store.accounts[0].status).toBe(ACCOUNT_STATUS.UNVERIFIED);
      expect(store.verificationTokens).toHaveLength(1);
      expect(store.effects).toHaveLength(1);
      expect(store.sessions).toHaveLength(0);
    });

    it('refuses when the asserted address already has an account, creating and linking nothing (BR-ID-3)', async () => {
      store.seedAccount(account());

      await expect(
        completeWith(assertion()).execute(command({ intent: SOCIAL_SIGN_IN_INTENT.REGISTER })),
      ).rejects.toBeInstanceOf(SocialEmailInUseError);

      expect(store.accounts).toHaveLength(1);
      expect(store.identities).toHaveLength(0);
      expect(store.sessions).toHaveLength(0);
    });

    it('reclaims an expired unverified account holding the address, then registers', async () => {
      const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
      store.seedAccount(
        account({
          id: 'expired-account',
          status: ACCOUNT_STATUS.UNVERIFIED,
          verifiedAt: null,
          createdAt: eightDaysAgo,
        }),
      );

      const issued = await completeWith(assertion()).execute(
        command({ intent: SOCIAL_SIGN_IN_INTENT.REGISTER }),
      );

      expect(issued.account.id).not.toBe('expired-account');
      expect(store.accounts).toHaveLength(1);
      expect(store.accounts[0].status).toBe(ACCOUNT_STATUS.ACTIVE);
    });
  });

  describe("UC-05's alternate flow — an identity linked to nothing", () => {
    it('offers registration instead of silently creating an account', async () => {
      await expect(
        completeWith(assertion()).execute(command({ intent: SOCIAL_SIGN_IN_INTENT.SIGN_IN })),
      ).rejects.toBeInstanceOf(SocialIdentityUnknownError);

      expect(store.accounts).toHaveLength(0);
      expect(store.sessions).toHaveLength(0);
    });
  });

  describe('guards', () => {
    it('refuses a disabled provider before any exchange', async () => {
      const port = new FakeIdentityProviderPort({ code: 'code-1', assertion: assertion() });
      const complete = new CompleteSocialSignIn(
        new FakeSocialProviderCatalog([fakeSettings(SOCIAL_PROVIDER.GOOGLE, { enabled: false })]),
        port,
        store,
        signer,
        () => now,
      );

      await expect(complete.execute(command())).rejects.toBeInstanceOf(
        SocialProviderUnavailableError,
      );
      expect(port.exchanges).toHaveLength(0);
    });

    it('rate-limits the completion path, and the refused attempt is not recorded', async () => {
      const complete = completeWith(assertion());
      store.seedAccount(account());
      store.seedIdentity({
        id: 'identity-1',
        accountId: 'account-1',
        provider: SOCIAL_PROVIDER.GOOGLE,
        subject: 'google-subject-1',
        assertedEmail: 'Ana.Popescu@example.md',
        emailVerifiedAsserted: true,
      });

      for (let i = 0; i < 5; i += 1) await complete.execute(command());

      await expect(complete.execute(command())).rejects.toBeInstanceOf(AuthRateLimitedError);
      expect(store.attempts).toHaveLength(5);
    });

    it('counts an attempt whose exchange then fails — the gate commits first', async () => {
      const complete = completeWith(assertion());

      await expect(complete.execute(command({ code: 'wrong-code' }))).rejects.toThrow();
      expect(store.attempts).toHaveLength(1);
    });
  });
});
