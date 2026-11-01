import type { SocialProvider } from '@api/contracts/identity-provider.port';
import { REQUESTED_SCOPES } from '@api/modules/identity/provider/domain/identity-provider-payload';
import type {
  IdentityProviderConfiguration,
  IdentityProviderUsage,
  ProviderSecretLocation,
  StoredIdentityProvider,
} from '../models/identity-provider.model';
import { enablementBlockerOf } from './identity-provider-rules';

/** A provider nobody has linked. */
export const NO_IDENTITY_PROVIDER_USAGE: IdentityProviderUsage = { linkedAccounts: 0, accountsWithoutOtherCredential: 0 };

/**
 * One provider as A-18 shows it (task 67.11) — from what the store holds in force, what the environment says
 * about its secret, and who has linked it.
 *
 * **A provider with nothing readable in force is shown unconfigured** — disabled, no client id, no issuer, no
 * addresses — rather than left out: FR-2 names it, so it is a provider to register, and the next save puts a
 * readable payload in place. **Its blocker is computed for an enabled provider too**, because a secret removed
 * from the environment leaves a provider enabled on paper and unavailable on S-01, which is the one thing the
 * operator most needs the screen to say.
 */
export const identityProviderConfigurationOf = (input: {
  readonly provider: SocialProvider;
  readonly stored: StoredIdentityProvider | null;
  readonly secret: ProviderSecretLocation;
  readonly usage: IdentityProviderUsage;
}): IdentityProviderConfiguration => {
  const settings = input.stored?.settings ?? {
    enabled: false,
    clientId: '',
    issuer: '',
    scopes: REQUESTED_SCOPES,
    redirectUris: [],
  };

  return {
    provider: input.provider,
    settings,
    revision: input.stored?.revision ?? 0,
    enablementBlocker: enablementBlockerOf({ settings, secretHeld: input.secret.held }),
    secret: input.secret,
    usage: input.usage,
    changedByEmail: input.stored?.changedByEmail ?? null,
    changedAt: input.stored?.changedAt ?? null,
  };
};
