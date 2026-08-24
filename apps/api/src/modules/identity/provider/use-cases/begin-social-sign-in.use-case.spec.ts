import { SOCIAL_PROVIDER } from '@api/contracts/identity-provider.port';
import {
  SocialProviderUnavailableError,
  SocialRedirectRejectedError,
} from '../errors/social.errors';
import {
  FakeIdentityProviderPort,
  FakeSocialProviderCatalog,
  fakeSettings,
} from '../testing/social-provider.fakes';
import { BeginSocialSignIn } from './begin-social-sign-in.use-case';

describe('BeginSocialSignIn (UC-02/UC-05 first half, FR-2, FR-82)', () => {
  const redirectUri = 'https://app.example/auth/social/google/callback';

  it('answers the authorization challenge for an enabled provider and allowed redirect', async () => {
    const port = new FakeIdentityProviderPort(null);
    const begin = new BeginSocialSignIn(
      new FakeSocialProviderCatalog([fakeSettings(SOCIAL_PROVIDER.GOOGLE)]),
      port,
    );

    const challenge = await begin.execute({ provider: SOCIAL_PROVIDER.GOOGLE, redirectUri });

    expect(challenge.authorizationUrl).toContain('client-google');
    expect(challenge.state).toBe('state-1');
    expect(challenge.nonce).toBe('nonce-1');
    expect(challenge.codeVerifier).toBe('verifier-1');
    expect(port.authorizationRequests[0].redirectUri).toBe(redirectUri);
  });

  it('refuses a disabled provider identically to an unregistered one (FR-82)', async () => {
    const port = new FakeIdentityProviderPort(null);
    const begin = new BeginSocialSignIn(
      new FakeSocialProviderCatalog([fakeSettings(SOCIAL_PROVIDER.GOOGLE, { enabled: false })]),
      port,
    );

    await expect(
      begin.execute({ provider: SOCIAL_PROVIDER.GOOGLE, redirectUri }),
    ).rejects.toBeInstanceOf(SocialProviderUnavailableError);
    await expect(
      begin.execute({ provider: SOCIAL_PROVIDER.MICROSOFT, redirectUri }),
    ).rejects.toBeInstanceOf(SocialProviderUnavailableError);
    // Neither refusal reached the provider port.
    expect(port.authorizationRequests).toHaveLength(0);
  });

  it('refuses a redirect URI outside the configured allowlist', async () => {
    const begin = new BeginSocialSignIn(
      new FakeSocialProviderCatalog([fakeSettings(SOCIAL_PROVIDER.GOOGLE)]),
      new FakeIdentityProviderPort(null),
    );

    await expect(
      begin.execute({
        provider: SOCIAL_PROVIDER.GOOGLE,
        redirectUri: 'https://evil.example/callback',
      }),
    ).rejects.toBeInstanceOf(SocialRedirectRejectedError);
  });
});
