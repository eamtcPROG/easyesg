import type { SocialProvider } from '@api/contracts/identity-provider.port';
import { REQUESTED_SCOPES } from '@api/modules/identity/provider/domain/identity-provider-payload';
import { enablementBlockerOf } from '../domain/identity-provider-rules';
import {
  IdentityProviderIncompleteError,
  IdentityProviderStateUnchangedError,
} from '../errors/identity-providers.errors';
import type { IdentityProviderConfigurationStore } from '../interfaces/identity-provider-configuration-store.interface';
import type { ProviderEnvironment } from '../interfaces/provider-environment.interface';
import {
  IDENTITY_PROVIDER_ENABLEMENT_BLOCKER,
  type IdentityProviderPublication,
} from '../models/identity-provider.model';

export interface ChangeIdentityProviderStateCommand {
  readonly provider: SocialProvider;
  readonly enabled: boolean;
  /** The revision the operator was looking at. */
  readonly revision: number;
  readonly operatorId: string;
}

/**
 * UC-70's first step — enabling and disabling a provider (task 67.11; FR-82, BR-ID-6). One behaviour in two
 * directions, as A-08's status change is.
 *
 * **Enabling is refused while the provider could not sign anyone in** (project owner, 14 Sep 2026): no client
 * id, no redirect address, or no client secret held — `enablementBlockerOf`'s first unmet condition, which A-18
 * shows before the click. **Disabling is never refused for what it strands**: a leaked secret is the case it
 * exists for, and making the operator wait is the outage FR-82 guards against. Who it strands is disclosed on the
 * screen, and they recover through a password reset (UC-09). **A change to the state a provider already has is
 * refused**, not recorded.
 */
export class ChangeIdentityProviderState {
  constructor(
    private readonly store: IdentityProviderConfigurationStore,
    private readonly environment: ProviderEnvironment,
  ) {}

  async execute(command: ChangeIdentityProviderStateCommand): Promise<IdentityProviderPublication> {
    const settings = (await this.store.read(command.provider))?.settings ?? null;

    if ((settings?.enabled ?? false) === command.enabled) {
      throw new IdentityProviderStateUnchangedError(command.enabled);
    }
    if (command.enabled) {
      const blocker = enablementBlockerOf({ settings, secretHeld: this.environment.secretOf(command.provider).held });
      if (blocker !== null) throw new IdentityProviderIncompleteError(blocker);
    }
    // Unreadable settings reach here only when enabling, which the blocker above has already refused.
    if (settings === null) {
      throw new IdentityProviderIncompleteError(IDENTITY_PROVIDER_ENABLEMENT_BLOCKER.CLIENT_ID_MISSING);
    }

    return this.store.publish({
      provider: command.provider,
      settings: { ...settings, enabled: command.enabled, scopes: REQUESTED_SCOPES },
      expectedRevision: command.revision,
      operatorId: command.operatorId,
    });
  }
}
