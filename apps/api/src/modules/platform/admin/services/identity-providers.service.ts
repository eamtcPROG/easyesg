import { Injectable } from '@nestjs/common';
import { isSocialProvider, type SocialProvider } from '@api/contracts/identity-provider.port';
import { IdentityProviderNotFoundError } from '../errors/identity-providers.errors';
import type { IdentityProviderConfiguration, IdentityProviderPublication } from '../models/identity-provider.model';
import {
  ChangeIdentityProviderState,
  type ChangeIdentityProviderStateCommand,
} from '../use-cases/change-identity-provider-state.use-case';
import {
  ConfigureIdentityProvider,
  type ConfigureIdentityProviderCommand,
} from '../use-cases/configure-identity-provider.use-case';
import { ListIdentityProviders } from '../use-cases/list-identity-providers.use-case';
import { requestOperatorId } from './request-operator';

/** What a route names: the provider as the path spelled it, which is not yet known to be one. */
type FromRoute<TCommand> = Omit<TCommand, 'provider' | 'operatorId'> & { readonly provider: string };

/**
 * A-18's application seam (task 67.11; UC-70) — the providers' reading and the two writes. It resolves the two
 * things a route cannot hand a use case: the acting operator, from the request (`request-operator.ts`), and a
 * provider from the path's text — **one FR-2 does not name answers as nothing found**, before anything is read.
 */
@Injectable()
export class IdentityProvidersService {
  constructor(
    private readonly listProviders: ListIdentityProviders,
    private readonly configureProvider: ConfigureIdentityProvider,
    private readonly changeProviderState: ChangeIdentityProviderState,
  ) {}

  list(): Promise<IdentityProviderConfiguration[]> {
    return this.listProviders.execute();
  }

  configure(input: FromRoute<ConfigureIdentityProviderCommand>): Promise<IdentityProviderPublication> {
    return this.configureProvider.execute({
      ...input,
      provider: knownProvider(input.provider),
      operatorId: requestOperatorId(),
    });
  }

  changeState(input: FromRoute<ChangeIdentityProviderStateCommand>): Promise<IdentityProviderPublication> {
    return this.changeProviderState.execute({
      ...input,
      provider: knownProvider(input.provider),
      operatorId: requestOperatorId(),
    });
  }
}

const knownProvider = (provider: string): SocialProvider => {
  if (!isSocialProvider(provider)) throw new IdentityProviderNotFoundError();
  return provider;
};
