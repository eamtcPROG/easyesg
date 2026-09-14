import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '@api/config/configuration';
import type { SocialProvider } from '@api/contracts/identity-provider.port';
import { SOCIAL_CLIENT_SECRET_SETTING } from '@api/modules/identity/provider/constants/provider.constants';
import type { ProviderEnvironment } from '@api/modules/platform/admin/interfaces/provider-environment.interface';
import type { ProviderSecretLocation } from '@api/modules/platform/admin/models/identity-provider.model';

/**
 * `PROVIDER_ENVIRONMENT` over the HTTP tier's configuration (task 67.11). **A secret is held when it is set and not
 * empty** — the catalog's own reading, which treats an empty secret as none and the provider as unavailable, so
 * A-18 and S-01 cannot disagree about whether a provider works. The value never leaves this method.
 */
@Injectable()
export class ConfigProviderEnvironment implements ProviderEnvironment {
  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  secretOf(provider: SocialProvider): ProviderSecretLocation {
    const secret = this.config.get('auth.social', { infer: true })[provider].clientSecret;
    return { held: secret !== undefined && secret !== '', setting: SOCIAL_CLIENT_SECRET_SETTING[provider] };
  }

  allowsInsecureIssuers(): boolean {
    return this.config.get('auth.social.allowInsecureIssuers', { infer: true });
  }
}
