import type { SocialProvider } from '@api/contracts/identity-provider.port';
import { SOCIAL_CLIENT_SECRET_SETTING } from '@api/modules/identity/provider/constants/provider.constants';
import { IdentityProviderChangedError } from '../errors/identity-providers.errors';
import type {
  IdentityProviderConfigurationStore,
  IdentityProviderPublicationRequest,
} from '../interfaces/identity-provider-configuration-store.interface';
import type { ProviderEnvironment } from '../interfaces/provider-environment.interface';
import type {
  IdentityProviderPublication,
  IdentityProviderUsage,
  ProviderSecretLocation,
  StoredIdentityProvider,
} from '../models/identity-provider.model';

/**
 * A-18's store, in memory (task 67.11). **It models the revision check** the configuration publisher makes
 * under its lock — a publication against a revision no longer in force is refused and records nothing — so a
 * use case's spec can assert a colleague's save is never overwritten rather than only that a call was made.
 */
export class FakeIdentityProviderConfigurationStore implements IdentityProviderConfigurationStore {
  readonly stored = new Map<SocialProvider, StoredIdentityProvider>();
  readonly usageByProvider = new Map<SocialProvider, IdentityProviderUsage>();
  readonly publications: IdentityProviderPublicationRequest[] = [];

  readAll(): Promise<readonly StoredIdentityProvider[]> {
    return Promise.resolve([...this.stored.values()]);
  }

  read(provider: SocialProvider): Promise<StoredIdentityProvider | null> {
    return Promise.resolve(this.stored.get(provider) ?? null);
  }

  usage(): Promise<ReadonlyMap<SocialProvider, IdentityProviderUsage>> {
    return Promise.resolve(this.usageByProvider);
  }

  publish(request: IdentityProviderPublicationRequest): Promise<IdentityProviderPublication> {
    const inForce = this.stored.get(request.provider)?.revision ?? 0;
    if (inForce !== request.expectedRevision) return Promise.reject(new IdentityProviderChangedError());

    const revision = inForce + 1;
    this.publications.push(request);
    this.stored.set(request.provider, {
      provider: request.provider,
      settings: request.settings,
      revision,
      changedByEmail: null,
      changedAt: null,
    });
    return Promise.resolve({ id: `version-${request.provider}-${revision}`, provider: request.provider, revision });
  }
}

/** The environment's answers, set by the spec: which secrets are held, and whether http issuers are admitted. */
export class FakeProviderEnvironment implements ProviderEnvironment {
  readonly held = new Set<SocialProvider>();
  insecure = false;

  secretOf(provider: SocialProvider): ProviderSecretLocation {
    return { held: this.held.has(provider), setting: SOCIAL_CLIENT_SECRET_SETTING[provider] };
  }

  allowsInsecureIssuers(): boolean {
    return this.insecure;
  }
}
