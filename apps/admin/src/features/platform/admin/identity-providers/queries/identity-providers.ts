import { queryOptions } from '@tanstack/react-query';
import type {
  ApiOutcome,
  ConfigureIdentityProviderRequest,
  IdentityProvider,
  IdentityProviderPublication,
  IdentityProviderRevisionRequest,
  SocialProvider,
} from '@easyesg/contracts';
import { api } from '~/realm/api/api-client';
import { PROVIDER_CONTROL, type ProviderAction } from '../tools/provider-action-state';

/**
 * A-18's read and its three writes (task 67.11), through the realm's one client. The outcome is the answer, not a
 * thrown error — A-02's reason: a 403 is a state the section draws. **No poll** (UX-116): a write invalidates the
 * key and the client refetches on focus, and a save against values a colleague has since changed is refused by
 * the api whatever this cache holds.
 */
export const IDENTITY_PROVIDERS_QUERY_KEY = ['admin', 'identity-providers'] as const;

export const identityProvidersQuery = () =>
  queryOptions({
    queryKey: IDENTITY_PROVIDERS_QUERY_KEY,
    queryFn: () => api.list<IdentityProvider>('/admin/identity-providers'),
  });

const providerPath = (provider: SocialProvider) => `/admin/identity-providers/${encodeURIComponent(provider)}`;

/** One function per action, each a configuration publication the api records in the system audit log. */
export function runProviderAction(action: ProviderAction): Promise<ApiOutcome<IdentityProviderPublication>> {
  switch (action.control) {
    case PROVIDER_CONTROL.SAVE:
      return api.post<ConfigureIdentityProviderRequest, IdentityProviderPublication>(
        `${providerPath(action.provider)}/configuration`,
        action.request,
      );
    case PROVIDER_CONTROL.ENABLE:
      return api.post<IdentityProviderRevisionRequest, IdentityProviderPublication>(
        `${providerPath(action.provider)}/enablement`,
        { revision: action.revision },
      );
    case PROVIDER_CONTROL.DISABLE:
      return api.post<IdentityProviderRevisionRequest, IdentityProviderPublication>(
        `${providerPath(action.provider)}/disablement`,
        { revision: action.revision },
      );
  }
}
