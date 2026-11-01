import { SOCIAL_PROVIDER } from '@api/contracts/identity-provider.port';
import { NO_IDENTITY_PROVIDER_USAGE, identityProviderConfigurationOf } from '../domain/identity-provider-configuration';
import type { IdentityProviderConfigurationStore } from '../interfaces/identity-provider-configuration-store.interface';
import type { ProviderEnvironment } from '../interfaces/provider-environment.interface';
import type { IdentityProviderConfiguration } from '../models/identity-provider.model';

/**
 * UC-70's reading — A-18's providers (task 67.11; FR-82): the providers FR-2 names, in declaration order, each with the
 * configuration in force, whether its secret is held and where it is set, who has linked it, and why it could not
 * be enabled if it could not.
 *
 * **Every provider FR-2 names is answered, configured or not**, since registering one is saving its first client
 * id — a provider missing from the list would be a provider nobody could register.
 */
export class ListIdentityProviders {
  constructor(
    private readonly store: IdentityProviderConfigurationStore,
    private readonly environment: ProviderEnvironment,
  ) {}

  async execute(): Promise<IdentityProviderConfiguration[]> {
    const [stored, usage] = await Promise.all([this.store.readAll(), this.store.usage()]);

    return Object.values(SOCIAL_PROVIDER).map((provider) =>
      identityProviderConfigurationOf({
        provider,
        stored: stored.find((entry) => entry.provider === provider) ?? null,
        secret: this.environment.secretOf(provider),
        usage: usage.get(provider) ?? NO_IDENTITY_PROVIDER_USAGE,
      }),
    );
  }
}
