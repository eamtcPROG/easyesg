import type { SocialProvider } from '@api/contracts/identity-provider.port';
import { REQUESTED_SCOPES } from '@api/modules/identity/provider/domain/identity-provider-payload';
import {
  issuerIsAdmissible,
  normalisedRedirectUris,
  redirectUriIsAdmissible,
  settingsAreUnchanged,
  socialCallbackPath,
} from '../domain/identity-provider-rules';
import {
  IdentityProviderEnabledIncompleteError,
  IdentityProviderIssuerInvalidError,
  IdentityProviderRedirectInvalidError,
  IdentityProviderUnchangedError,
} from '../errors/identity-providers.errors';
import type { IdentityProviderConfigurationStore } from '../interfaces/identity-provider-configuration-store.interface';
import type { ProviderEnvironment } from '../interfaces/provider-environment.interface';
import type { IdentityProviderPublication, IdentityProviderSettings } from '../models/identity-provider.model';

export interface ConfigureIdentityProviderCommand {
  readonly provider: SocialProvider;
  readonly clientId: string;
  readonly issuer: string;
  readonly redirectUris: readonly string[];
  /** The revision the operator edited. */
  readonly revision: number;
  readonly operatorId: string;
}

/**
 * UC-70's second step — maintaining a provider's client id, issuer and redirect addresses (task 67.11; FR-82).
 * **Registering a provider is this**, the first time its client id is saved, and rotating the client id is this
 * again.
 *
 * **The enabled state is carried, never set here**, so a save and an enablement are two audit actions and a save
 * cannot enable a provider past the checks enabling makes. **The scopes are written as FR-2's three** whatever
 * the payload in force held — the one field A-18 shows and does not offer (project owner, 14 Sep 2026).
 *
 * Refused, each for a reason an operator can act on: an issuer or a redirect address the flow could not use; a
 * save that would leave an enabled provider unable to sign anyone in; a save identical to what is in force,
 * which the audit log would otherwise record as a change; and a revision no longer in force, which the store
 * refuses so a colleague's save is never silently overwritten.
 */
export class ConfigureIdentityProvider {
  constructor(
    private readonly store: IdentityProviderConfigurationStore,
    private readonly environment: ProviderEnvironment,
  ) {}

  async execute(command: ConfigureIdentityProviderCommand): Promise<IdentityProviderPublication> {
    const allowInsecure = this.environment.allowsInsecureIssuers();
    const issuer = command.issuer.trim();
    const redirectUris = normalisedRedirectUris(command.redirectUris);

    if (!issuerIsAdmissible({ issuer, allowInsecure })) throw new IdentityProviderIssuerInvalidError();
    if (!redirectUris.every((uri) => redirectUriIsAdmissible({ provider: command.provider, uri, allowInsecure }))) {
      throw new IdentityProviderRedirectInvalidError(socialCallbackPath(command.provider));
    }

    const current = await this.store.read(command.provider);
    const settings: IdentityProviderSettings = {
      enabled: current?.settings?.enabled ?? false,
      clientId: command.clientId.trim(),
      issuer,
      scopes: REQUESTED_SCOPES,
      redirectUris,
    };

    if (settings.enabled && (settings.clientId === '' || redirectUris.length === 0)) {
      throw new IdentityProviderEnabledIncompleteError();
    }
    if (settingsAreUnchanged({ before: current?.settings ?? null, after: settings })) {
      throw new IdentityProviderUnchangedError();
    }

    return this.store.publish({
      provider: command.provider,
      settings,
      expectedRevision: command.revision,
      operatorId: command.operatorId,
    });
  }
}
