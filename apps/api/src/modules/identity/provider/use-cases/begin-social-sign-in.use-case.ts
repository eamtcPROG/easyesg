import type {
  IdentityProviderPort,
  ProviderAuthorizationChallenge,
  SocialProvider,
} from '@api/contracts/identity-provider.port';
import { SocialProviderUnavailableError, SocialRedirectRejectedError } from '../errors/social.errors';
import type { SocialProviderCatalog } from '../interfaces/social-provider-catalog.interface';

export interface BeginSocialSignInCommand {
  readonly provider: SocialProvider;
  /** Where the provider should send the browser back — checked against A-18's allowlist. */
  readonly redirectUri: string;
}

/**
 * UC-02/UC-05's first half: build the authorization redirect (FR-2, FR-4).
 *
 * Framework-free, constructed by `useFactory` like every use case here. Deliberately stateless —
 * the challenge's `state`, `nonce` and PKCE verifier go back to the caller, who holds them across
 * the redirect in the web tier's sealed transaction cookie (§12.5.6's task-24 flow row), so no
 * pending-flow table exists to leak, expire or clean.
 *
 * The enabled check is FR-82's bite point: a disabled provider refuses HERE, before any browser
 * leaves for it, and the answer is identical for a provider that never existed. The redirect-URI
 * allowlist is checked even though the provider checks its own registration, because ours is the
 * one A-18 edits — a mismatch should fail at the platform's boundary with the platform's error,
 * not surface as a provider screen the user cannot act on.
 *
 * No throttle, recorded rather than omitted: nothing here verifies a credential or touches an
 * account, so there is no guessing surface for §12.5.6's window to bound — the edge's
 * unauthenticated budget covers volume.
 */
export class BeginSocialSignIn {
  constructor(
    private readonly catalog: SocialProviderCatalog,
    private readonly providerPort: IdentityProviderPort,
  ) {}

  async execute(command: BeginSocialSignInCommand): Promise<ProviderAuthorizationChallenge> {
    const settings = this.catalog.resolve(command.provider);
    if (!settings?.enabled) throw new SocialProviderUnavailableError();
    if (!settings.redirectUris.includes(command.redirectUri)) {
      throw new SocialRedirectRejectedError();
    }

    return this.providerPort.beginAuthorization({ settings, redirectUri: command.redirectUri });
  }
}
