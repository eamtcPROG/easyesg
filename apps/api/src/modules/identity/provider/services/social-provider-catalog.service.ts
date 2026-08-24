import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '@api/config/configuration';
import { ConfigurationStore } from '@api/infrastructure/configuration/configuration-store.service';
import {
  SOCIAL_PROVIDER,
  type SocialProvider,
  type SocialProviderSettings,
} from '@api/contracts/identity-provider.port';
import { IDENTITY_PROVIDER_CONFIG_KIND } from '../constants/provider.constants';
import type { SocialProviderCatalog } from '../interfaces/social-provider-catalog.interface';

/** The store payload's expected shape — what A-18 edits and `config/seed` provides. */
interface IdentityProviderConfigPayload {
  readonly enabled: boolean;
  readonly clientId: string;
  readonly issuer: string;
  readonly scopes: readonly string[];
  readonly redirectUris: readonly string[];
}

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string');

/**
 * Validated, never cast — configuration is data someone edits, and a malformed payload must
 * surface as "this provider is unavailable" plus an operator-facing log line, not as an
 * `undefined` threading itself into an authorization URL.
 */
const readPayload = (payload: Record<string, unknown>): IdentityProviderConfigPayload | null => {
  if (
    typeof payload.enabled !== 'boolean' ||
    typeof payload.clientId !== 'string' ||
    typeof payload.issuer !== 'string' ||
    !isStringArray(payload.scopes) ||
    !isStringArray(payload.redirectUris)
  ) {
    return null;
  }
  return {
    enabled: payload.enabled,
    clientId: payload.clientId,
    issuer: payload.issuer,
    scopes: payload.scopes,
    redirectUris: payload.redirectUris,
  };
};

/**
 * FR-82's join, and the ONLY place the split of §12.5.6's task-24 configuration row is visible:
 * behaviour from the configuration store (kind `identity-provider`, scope = provider — changed
 * with no redeploy, ≤5 s propagation), the client secret from the environment (per-provider,
 * HTTP tier only, OpenBao when it exists). Callers get one `SocialProviderSettings` and cannot
 * tell which half a field came from.
 *
 * An enabled provider whose secret is missing resolves to `null` — unavailable — with an error
 * logged: the §9.1 secrets throw at boot because their absence breaks the whole tier, but a
 * provider secret's absence breaks one provider, and taking the api down over it would turn a
 * misconfiguration into the outage FR-82 exists to prevent.
 */
@Injectable()
export class SocialProviderCatalogService implements SocialProviderCatalog {
  private readonly logger = new Logger(SocialProviderCatalogService.name);

  constructor(
    private readonly configurationStore: ConfigurationStore,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  resolve(provider: SocialProvider): SocialProviderSettings | null {
    const entry = this.configurationStore.get(IDENTITY_PROVIDER_CONFIG_KIND, provider);
    if (!entry) return null;

    const payload = readPayload(entry.payload);
    if (!payload) {
      this.logger.error(
        `Configuration entry ${IDENTITY_PROVIDER_CONFIG_KIND}/${provider} (revision ${entry.revision}) is malformed; treating the provider as unavailable`,
      );
      return null;
    }

    const social = this.config.get('auth.social', { infer: true });
    const clientSecret = social[provider].clientSecret;
    if (payload.enabled && !clientSecret) {
      this.logger.error(
        `Provider '${provider}' is enabled but its client secret is not configured; treating it as unavailable`,
      );
      return null;
    }

    return {
      provider,
      enabled: payload.enabled,
      clientId: payload.clientId,
      clientSecret: clientSecret ?? '',
      issuer: payload.issuer,
      scopes: payload.scopes,
      redirectUris: payload.redirectUris,
    };
  }

  enabledProviders(): SocialProvider[] {
    // Declaration order — the same order every derived surface uses (CLAUDE.md, vocabularies).
    return Object.values(SOCIAL_PROVIDER).filter(
      (provider) => this.resolve(provider)?.enabled === true,
    );
  }
}
