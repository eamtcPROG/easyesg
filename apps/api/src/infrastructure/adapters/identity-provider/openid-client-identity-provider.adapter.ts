import { Logger } from '@nestjs/common';
import * as client from 'openid-client';
import { SocialExchangeFailedError } from '@api/modules/identity/provider/errors/social.errors';
import type {
  IdentityProviderPort,
  ProviderAssertion,
  ProviderAuthorizationChallenge,
  ProviderAuthorizationRequest,
  ProviderCodeExchange,
  SocialProviderSettings,
} from '@api/contracts/identity-provider.port';

/**
 * `IdentityProviderPort` over `openid-client` 6 (§12.1, task 24) — the one file where the vendor
 * exists (P-7, NFR-11): no openid-client type, error or claim shape leaves this adapter.
 *
 * **The import is a plain static one, and that is a recorded fact, not an oversight.** The
 * package is ESM-only; this app is CommonJS on `module: nodenext`, so tsc emits `require()` and
 * Node 26's stable `require(esm)` loads it — proven for Node and for Jest's runtime alike before
 * the pin was taken (OQ-48's revisit, 24 Aug 2026). No dynamic-import bridge.
 *
 * What the library owns here and the platform must not re-implement (the `otpauth` lesson,
 * §12.1): `state`/`nonce`/PKCE generation, the authorization URL, the token exchange, and ID
 * token validation — signature against the discovered JWKS, issuer (including Entra's
 * `{tenantid}` template, which the library resolves from the token's own `tid` claim), audience,
 * expiry and `nonce`.
 *
 * Discovered configurations are cached per (issuer, client id, secret): discovery is a network
 * round trip the sign-in path must not repeat per click, and keying on the secret means an FR-82
 * rotation simply builds a fresh entry rather than serving the retired credential. A failed
 * discovery is evicted so an outage is retried, not cached.
 */
export class OpenIdClientIdentityProvider implements IdentityProviderPort {
  private readonly logger = new Logger(OpenIdClientIdentityProvider.name);

  private readonly configurations = new Map<string, Promise<client.Configuration>>();

  constructor(
    /**
     * Permits `http://` issuers — the e2e stub provider. Never set in production; an `https`
     * issuer is unaffected either way, so the flag cannot weaken a real provider.
     */
    private readonly allowInsecureIssuers: boolean,
  ) {}

  async beginAuthorization(
    request: ProviderAuthorizationRequest,
  ): Promise<ProviderAuthorizationChallenge> {
    const configuration = await this.configurationFor(request.settings);

    const codeVerifier = client.randomPKCECodeVerifier();
    const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
    // State always, not only where PKCE support is undiscoverable: it is what the web tier binds
    // the callback to its transaction cookie with, independent of what the token endpoint checks.
    const state = client.randomState();
    const nonce = client.randomNonce();

    const authorizationUrl = client.buildAuthorizationUrl(configuration, {
      redirect_uri: request.redirectUri,
      scope: request.settings.scopes.join(' '),
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state,
      nonce,
    });

    return { authorizationUrl: authorizationUrl.href, state, nonce, codeVerifier };
  }

  async exchangeCode(exchange: ProviderCodeExchange): Promise<ProviderAssertion> {
    try {
      const configuration = await this.configurationFor(exchange.settings);

      // openid-client reads the authorization response off a URL; reconstruct the callback as
      // the browser presented it to the web tier.
      const callbackUrl = new URL(exchange.redirectUri);
      callbackUrl.searchParams.set('code', exchange.code);
      callbackUrl.searchParams.set('state', exchange.state);

      const tokens = await client.authorizationCodeGrant(configuration, callbackUrl, {
        pkceCodeVerifier: exchange.codeVerifier,
        expectedState: exchange.state,
        expectedNonce: exchange.nonce,
      });

      const claims = tokens.claims();
      const email = typeof claims?.email === 'string' ? claims.email : null;
      if (!claims || !email) {
        // FR-2's flow is unfulfillable without an address — nothing to match, nothing to
        // register. Requested scopes include email, so this is a provider misconfiguration.
        this.logger.warn(
          `Provider '${exchange.settings.provider}' asserted no email address; refusing the exchange`,
        );
        throw new SocialExchangeFailedError();
      }

      return {
        subject: claims.sub,
        email,
        // Strictly `=== true`: Entra commonly asserts nothing here, and an unasserted claim must
        // read as unverified (UC-03's alternate covers only asserted-verified addresses).
        emailVerified: claims.email_verified === true,
        displayName: typeof claims.name === 'string' ? claims.name : null,
      };
    } catch (error) {
      if (error instanceof SocialExchangeFailedError) throw error;
      // One platform answer for every provider-side refusal (the port documents why). The cause
      // is logged for the operator — by name and class, never token contents (NFR-30).
      this.logger.warn(
        `Code exchange with '${exchange.settings.provider}' failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      throw new SocialExchangeFailedError();
    }
  }

  private configurationFor(settings: SocialProviderSettings): Promise<client.Configuration> {
    const key = [settings.issuer, settings.clientId, settings.clientSecret].join('\n');
    const cached = this.configurations.get(key);
    if (cached) return cached;

    const discovered = client
      .discovery(new URL(settings.issuer), settings.clientId, settings.clientSecret, undefined, {
        execute:
          this.allowInsecureIssuers && settings.issuer.startsWith('http://')
            ? [client.allowInsecureRequests]
            : undefined,
      })
      .catch((error: unknown) => {
        // Evict so the next attempt retries discovery instead of replaying an outage forever.
        this.configurations.delete(key);
        throw error;
      });

    this.configurations.set(key, discovered);
    return discovered;
  }
}
