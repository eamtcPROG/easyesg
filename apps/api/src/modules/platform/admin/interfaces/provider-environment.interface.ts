import type { SocialProvider } from '@api/contracts/identity-provider.port';
import type { ProviderSecretLocation } from '../models/identity-provider.model';

export const PROVIDER_ENVIRONMENT = Symbol('PROVIDER_ENVIRONMENT');

/**
 * What the environment says about the social providers (task 67.11) — the half of FR-82 A-18 reports on and
 * cannot change: whether each client secret is held and where it is set, and whether http issuers are admitted.
 *
 * **A port rather than `ConfigService` in the use cases**, because task 154 moves the secrets into OpenBao: the
 * answer's source changes there and the question A-18 asks does not.
 */
export interface ProviderEnvironment {
  secretOf(provider: SocialProvider): ProviderSecretLocation;

  allowsInsecureIssuers(): boolean;
}
