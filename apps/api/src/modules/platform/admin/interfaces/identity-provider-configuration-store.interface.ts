import type { SocialProvider } from '@api/contracts/identity-provider.port';
import type {
  IdentityProviderPublication,
  IdentityProviderSettings,
  IdentityProviderUsage,
  StoredIdentityProvider,
} from '../models/identity-provider.model';

export const IDENTITY_PROVIDER_CONFIGURATION_STORE = Symbol('IDENTITY_PROVIDER_CONFIGURATION_STORE');

export interface IdentityProviderPublicationRequest {
  readonly provider: SocialProvider;
  readonly settings: IdentityProviderSettings;
  /** The revision the change was made against; any other in force refuses it with `IdentityProviderChangedError`. */
  readonly expectedRevision: number;
  /** The operator publishing — the version's `created_by`, which A-18's attribution line names. */
  readonly operatorId: string;
}

/**
 * A-18's store (task 67.11): what is in force for each provider in the slot the console publishes into, who has
 * linked each, and the publication.
 *
 * **Its adapter reads as `esg_app`, and acquires nothing.** Configuration is global rather than tenant data and
 * the application already reads it; the usage figures are counts over identity tables that carry no row security
 * and name no organization, so none of this is a read across organizations `esg_admin_ro` exists for.
 */
export interface IdentityProviderConfigurationStore {
  readAll(): Promise<readonly StoredIdentityProvider[]>;

  read(provider: SocialProvider): Promise<StoredIdentityProvider | null>;

  /** Per provider; a provider nobody has linked is absent. */
  usage(): Promise<ReadonlyMap<SocialProvider, IdentityProviderUsage>>;

  publish(request: IdentityProviderPublicationRequest): Promise<IdentityProviderPublication>;
}
