import { useQuery } from '@tanstack/react-query';
import { Navigate, useLocation } from '@tanstack/react-router';
import { REALM_READ } from '~/realm/tools/realm-read';
import { identityProvidersQuery } from '../../../queries/identity-providers';
import type { IdentityProvidersSearch } from '../../../tools/identity-providers-search';
import { readProvidersOutcome } from '../../../tools/providers-read';
import { ProvidersBoard } from '../board/providers-board';
import { ProvidersForbidden } from '../states/providers-forbidden';
import { ProvidersLoading } from '../states/providers-loading';
import { ProvidersUnavailable } from '../states/providers-unavailable';

/**
 * A-18's providers region (task 67.11). **The section reads and picks the arm**: the providers, §5.2's permission
 * state for a Billing Operator, a sign-in for a session that ended, or a retry.
 */
export function ProvidersSection({
  search,
  onSearchChange,
}: {
  readonly search: IdentityProvidersSearch;
  readonly onSearchChange: (next: IdentityProvidersSearch) => void;
}) {
  const query = useQuery(identityProvidersQuery());
  const href = useLocation({ select: (location) => location.href });

  if (query.data === undefined) {
    return query.isError ? <ProvidersUnavailable onRetry={() => void query.refetch()} /> : <ProvidersLoading />;
  }

  const read = readProvidersOutcome(query.data);
  switch (read.kind) {
    case REALM_READ.SIGNED_OUT:
      return <Navigate to="/sign-in" search={{ redirect: href }} />;
    case REALM_READ.FORBIDDEN:
      return <ProvidersForbidden />;
    case REALM_READ.UNAVAILABLE:
      return <ProvidersUnavailable onRetry={() => void query.refetch()} />;
    case REALM_READ.READY:
      return <ProvidersBoard providers={read.providers} search={search} onSearchChange={onSearchChange} />;
  }
}
