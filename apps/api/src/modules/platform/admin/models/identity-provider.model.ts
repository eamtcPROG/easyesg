import type { SocialProvider } from '@api/contracts/identity-provider.port';
import type { IdentityProviderPayload } from '@api/modules/identity/provider/domain/identity-provider-payload';

/**
 * A-18's reading of a social provider (task 67.11; UC-70, FR-82; §12.5.6's task-67.11 row). A provider has two
 * halves and this model keeps them apart: its **behaviour**, configuration-store data an operator edits with no
 * redeploy, and its **client secret**, which the environment holds and the console reports on without editing.
 */

/**
 * Why a provider cannot be enabled yet — the first unmet condition, in the order an operator meets them: a
 * client id to give it, an address to return to, then the secret the console cannot set. Refused by
 * `ChangeIdentityProviderState` and shown on A-18 before anyone asks, from one derivation.
 */
export const IDENTITY_PROVIDER_ENABLEMENT_BLOCKER = {
  CLIENT_ID_MISSING: 'client_id_missing',
  REDIRECT_MISSING: 'redirect_missing',
  SECRET_MISSING: 'secret_missing',
} as const;

export type IdentityProviderEnablementBlocker =
  (typeof IDENTITY_PROVIDER_ENABLEMENT_BLOCKER)[keyof typeof IDENTITY_PROVIDER_ENABLEMENT_BLOCKER];

/** The behaviour half, as the configuration store holds it. */
export type IdentityProviderSettings = IdentityProviderPayload;

/** What is in force in A-18's slot for one provider, and who put it there. */
export interface StoredIdentityProvider {
  readonly provider: SocialProvider;
  /** Null where the payload in force does not read as settings; the next save replaces it. */
  readonly settings: IdentityProviderSettings | null;
  /** 0 where nothing has ever been published for the provider. */
  readonly revision: number;
  /** The operator who published it — null for a seed, which no operator published. */
  readonly changedByEmail: string | null;
  readonly changedAt: Date | null;
}

/** Who a provider's withdrawal reaches — the consequence UX-70 has A-18 name before a disable. */
export interface IdentityProviderUsage {
  /** Accounts holding an identity through the provider. */
  readonly linkedAccounts: number;
  /** Of those, the accounts with no password and no other provider, who sign in again through a password reset (UC-09). */
  readonly accountsWithoutOtherCredential: number;
}

/** Whether the environment holds a provider's client secret, and where it is set — never its value. */
export interface ProviderSecretLocation {
  readonly held: boolean;
  /** The setting that holds it: an environment variable until task 154. */
  readonly setting: string;
}

/** One provider as A-18 shows it. */
export interface IdentityProviderConfiguration {
  readonly provider: SocialProvider;
  readonly settings: IdentityProviderSettings;
  readonly revision: number;
  readonly enablementBlocker: IdentityProviderEnablementBlocker | null;
  readonly secret: ProviderSecretLocation;
  readonly usage: IdentityProviderUsage;
  readonly changedByEmail: string | null;
  readonly changedAt: Date | null;
}

/** A configuration version just put in force — its id is what the system audit log names. */
export interface IdentityProviderPublication {
  readonly id: string;
  readonly provider: SocialProvider;
  readonly revision: number;
}
