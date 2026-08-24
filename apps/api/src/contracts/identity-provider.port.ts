/**
 * Social identity providers (FR-2, FR-4, FR-82; D-6; §9.1).
 *
 * The port architecture.md §6 names `IdentityProviderPort`: the OIDC mechanics — building an
 * authorization request, exchanging a code, validating an ID token — behind one seam, so that a
 * provider is a *registration* (configuration rows plus a secret) and never an implementation.
 * That is what D-6 rests on when it says enterprise SSO later is "a provider registration rather
 * than a rework", and it is the P-7 guarantee task 24's deliverable states: swapping the adapter
 * changes no caller behaviour.
 *
 * The port is deliberately **stateless about providers**: every call carries the provider's
 * settings, resolved by the caller from the configuration store and the environment (§12.5.6's
 * task-24 configuration row). An adapter that read configuration itself would make each adapter
 * re-implement FR-82's resolution, which is exactly the duplication the seam exists to prevent.
 *
 * No vendor type crosses this boundary (NFR-11): no openid-client class, error or response shape
 * appears in `modules/*` — the adapter maps them onto these platform shapes.
 */

/**
 * The providers FR-2 names for MVP. The wire path parameter, the configuration scope and the
 * `provider_identity.provider` column all carry these values; the migration's CHECK constraint is
 * the database's own literal copy of this vocabulary (CLAUDE.md, "A closed vocabulary").
 */
export const SOCIAL_PROVIDER = {
  GOOGLE: 'google',
  MICROSOFT: 'microsoft',
} as const;

export type SocialProvider = (typeof SOCIAL_PROVIDER)[keyof typeof SOCIAL_PROVIDER];

export const isSocialProvider = (value: string): value is SocialProvider =>
  (Object.values(SOCIAL_PROVIDER) as string[]).includes(value);

/**
 * A provider as resolved for one call: the config-store payload (enabled state, client id,
 * issuer, scopes, redirect allowlist) joined with the environment's client secret. FR-82's
 * split is visible in the shape — everything here except `clientSecret` is store data a
 * Platform Administrator can change with no redeploy.
 */
export interface SocialProviderSettings {
  readonly provider: SocialProvider;
  readonly enabled: boolean;
  readonly clientId: string;
  readonly clientSecret: string;
  /** The OIDC issuer identifier discovery runs against. */
  readonly issuer: string;
  /** FR-2: identifier, email and display name — and nothing further. */
  readonly scopes: readonly string[];
  /** Exact-match allowlist for the `redirect_uri` a caller presents (A-18's "redirect configuration"). */
  readonly redirectUris: readonly string[];
}

export interface ProviderAuthorizationRequest {
  readonly settings: SocialProviderSettings;
  readonly redirectUri: string;
}

/**
 * What the caller must hold across the redirect: the URL to send the browser to, and the three
 * values that bind the eventual callback to this request. They travel sealed in the web tier's
 * transaction cookie (§12.5.6, task-24 flow row) — never readable in the browser.
 */
export interface ProviderAuthorizationChallenge {
  readonly authorizationUrl: string;
  readonly state: string;
  readonly nonce: string;
  readonly codeVerifier: string;
}

export interface ProviderCodeExchange {
  readonly settings: SocialProviderSettings;
  readonly redirectUri: string;
  readonly code: string;
  readonly state: string;
  readonly nonce: string;
  readonly codeVerifier: string;
}

/**
 * What an ID token asserts, reduced to what the platform stores (the FR data inventory's
 * "Provider identity" row) plus the display name FR-2's third scope requests. The subject is the
 * matching key — never the email (UC-05, §9.1: emails are reassignable at the provider and
 * matching on one is an account-takeover path).
 */
export interface ProviderAssertion {
  readonly subject: string;
  readonly email: string;
  /** Whether the provider asserts the address as verified — UC-03's automatic satisfaction. */
  readonly emailVerified: boolean;
  /** Received per FR-2; unconsumed until the profile exists (FR-9). Never persisted today. */
  readonly displayName: string | null;
}

export interface IdentityProviderPort {
  /** Builds the authorization redirect, minting `state`, `nonce` and the PKCE verifier. */
  beginAuthorization(request: ProviderAuthorizationRequest): Promise<ProviderAuthorizationChallenge>;

  /**
   * Redeems the code and validates the ID token — issuer, audience, signature, `nonce`, expiry —
   * before anything here is believed. Throws `ProviderExchangeFailedError` for every way the
   * provider or the token can refuse; the caller cannot tell them apart and must not (the
   * distinctions would only describe our infrastructure to a caller probing it).
   */
  exchangeCode(exchange: ProviderCodeExchange): Promise<ProviderAssertion>;
}

/** DI token beside the interface, so a consumer imports one thing (CLAUDE.md, P-7). */
export const IDENTITY_PROVIDER_PORT = Symbol('IDENTITY_PROVIDER_PORT');
