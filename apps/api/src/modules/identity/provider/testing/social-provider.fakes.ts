import type {
  IdentityProviderPort,
  ProviderAssertion,
  ProviderAuthorizationChallenge,
  ProviderAuthorizationRequest,
  ProviderCodeExchange,
  SocialProvider,
  SocialProviderSettings,
} from '@api/contracts/identity-provider.port';
import { SocialExchangeFailedError } from '../errors/social.errors';
import type { SocialProviderCatalog } from '../interfaces/social-provider-catalog.interface';

/** Settings a spec can hand the fake catalog — real-shaped, one call to make. */
export const fakeSettings = (
  provider: SocialProvider,
  overrides: Partial<SocialProviderSettings> = {},
): SocialProviderSettings => ({
  provider,
  enabled: true,
  clientId: `client-${provider}`,
  clientSecret: `secret-${provider}`,
  issuer: `https://issuer.example/${provider}`,
  scopes: ['openid', 'email', 'profile'],
  redirectUris: [`https://app.example/auth/social/${provider}/callback`],
  ...overrides,
});

export class FakeSocialProviderCatalog implements SocialProviderCatalog {
  constructor(private readonly settings: SocialProviderSettings[]) {}

  resolve(provider: SocialProvider): SocialProviderSettings | null {
    return this.settings.find((s) => s.provider === provider) ?? null;
  }

  enabledProviders(): SocialProvider[] {
    return this.settings.filter((s) => s.enabled).map((s) => s.provider);
  }
}

/**
 * The port, modelled rather than stubbed where behaviour matters: it records what it was asked,
 * answers a canned challenge, and exchanges only the one code it was configured to accept — an
 * unknown code fails the way the adapter fails, so a spec exercises the caller's error path
 * against the port's real contract.
 */
export class FakeIdentityProviderPort implements IdentityProviderPort {
  readonly authorizationRequests: ProviderAuthorizationRequest[] = [];
  readonly exchanges: ProviderCodeExchange[] = [];

  constructor(
    private readonly accepts: { readonly code: string; readonly assertion: ProviderAssertion } | null,
  ) {}

  beginAuthorization(
    request: ProviderAuthorizationRequest,
  ): Promise<ProviderAuthorizationChallenge> {
    this.authorizationRequests.push(request);
    return Promise.resolve({
      authorizationUrl: `https://issuer.example/authorize?client_id=${request.settings.clientId}`,
      state: 'state-1',
      nonce: 'nonce-1',
      codeVerifier: 'verifier-1',
    });
  }

  exchangeCode(exchange: ProviderCodeExchange): Promise<ProviderAssertion> {
    this.exchanges.push(exchange);
    if (this.accepts && exchange.code === this.accepts.code) {
      return Promise.resolve(this.accepts.assertion);
    }
    return Promise.reject(new SocialExchangeFailedError());
  }
}
