import type { SocialProvider } from '@api/contracts/identity-provider.port';
import {
  IDENTITY_PROVIDER_ENABLEMENT_BLOCKER,
  type IdentityProviderEnablementBlocker,
  type IdentityProviderSettings,
} from '../models/identity-provider.model';

/**
 * What A-18 may write into a provider's configuration, and when a provider may be enabled (task 67.11; UC-70,
 * FR-82; §12.5.6's task-67.11 row). Pure, and read by the refusals and by the screen's reading alike, so the
 * reason the console shows before a click is the reason the api gives after one.
 */

/**
 * The path `apps/web` serves a provider's return on (§12.5.6's task-24 flow row) — fixed and unlocalized,
 * because it is the address registered at the provider. A redirect address naming any other path could never
 * be presented by the web tier, so it is refused rather than stored as configuration nothing can use.
 */
export const socialCallbackPath = (provider: SocialProvider): string => `/auth/social/${provider}/callback`;

const SECURE_PROTOCOL = 'https:';
const INSECURE_PROTOCOL = 'http:';

const urlOf = (value: string): URL | null => {
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

/** An address a provider can be pointed at: absolute, with no credentials, no query and no fragment. */
const isBareAddress = (url: URL): boolean =>
  url.username === '' && url.password === '' && url.search === '' && url.hash === '';

/**
 * https — or http where the environment admits insecure issuers, `AUTH_SOCIAL_ALLOW_INSECURE`, the e2e stub's
 * switch and never set in production. One switch for the issuer and the redirect alike, because an environment
 * talking to an http provider is a test environment for both.
 */
const admitsProtocol = (input: { readonly url: URL; readonly allowInsecure: boolean }): boolean =>
  input.url.protocol === SECURE_PROTOCOL || (input.allowInsecure && input.url.protocol === INSECURE_PROTOCOL);

export const issuerIsAdmissible = (input: { readonly issuer: string; readonly allowInsecure: boolean }): boolean => {
  const url = urlOf(input.issuer);
  return url !== null && isBareAddress(url) && admitsProtocol({ url, allowInsecure: input.allowInsecure });
};

export const redirectUriIsAdmissible = (input: {
  readonly provider: SocialProvider;
  readonly uri: string;
  readonly allowInsecure: boolean;
}): boolean => {
  const url = urlOf(input.uri);
  return (
    url !== null &&
    isBareAddress(url) &&
    admitsProtocol({ url, allowInsecure: input.allowInsecure }) &&
    url.pathname === socialCallbackPath(input.provider)
  );
};

/**
 * Trimmed, blanks dropped, each address once, in the order given — a pasted list ending in a newline is not a
 * second address, and `BeginSocialSignIn` matches the allowlist exactly, so a stray space would be an address
 * nobody can present.
 */
export const normalisedRedirectUris = (uris: readonly string[]): string[] => [
  ...new Set(uris.map((uri) => uri.trim()).filter((uri) => uri !== '')),
];

/**
 * The first reason a provider could not sign anyone in, or null when it could. `BeginSocialSignIn` refuses a
 * redirect the allowlist does not hold and the catalog treats an enabled provider with no secret as unavailable
 * — so enabling past either would put a button on S-01 that fails when pressed.
 */
export const enablementBlockerOf = (input: {
  readonly settings: Pick<IdentityProviderSettings, 'clientId' | 'redirectUris'> | null;
  readonly secretHeld: boolean;
}): IdentityProviderEnablementBlocker | null => {
  if (input.settings === null || input.settings.clientId.trim() === '') {
    return IDENTITY_PROVIDER_ENABLEMENT_BLOCKER.CLIENT_ID_MISSING;
  }
  if (input.settings.redirectUris.length === 0) return IDENTITY_PROVIDER_ENABLEMENT_BLOCKER.REDIRECT_MISSING;
  if (!input.secretHeld) return IDENTITY_PROVIDER_ENABLEMENT_BLOCKER.SECRET_MISSING;
  return null;
};

const sameList = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((entry, index) => entry === right[index]);

/** Whether a proposed configuration is the one already in force — refused rather than recorded as a change. */
export const settingsAreUnchanged = (input: {
  readonly before: IdentityProviderSettings | null;
  readonly after: IdentityProviderSettings;
}): boolean =>
  input.before !== null &&
  input.before.enabled === input.after.enabled &&
  input.before.clientId === input.after.clientId &&
  input.before.issuer === input.after.issuer &&
  sameList(input.before.scopes, input.after.scopes) &&
  sameList(input.before.redirectUris, input.after.redirectUris);
