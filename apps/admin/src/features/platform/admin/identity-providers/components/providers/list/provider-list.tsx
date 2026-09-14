import type { IdentityProvider, SocialProvider } from '@easyesg/contracts';
import { DataTable } from '@easyesg/ui';
import { useTranslations } from 'use-intl';
import { useProviderColumns } from './provider-columns';

/** Hoisted, so the table receives the same function every render. */
const rowKey = (row: IdentityProvider): string => row.provider;

/**
 * A-18's providers (task 67.11). **A table, not an Index**: the providers are read whole, with nothing to page,
 * search or filter — and never empty, since every provider FR-2 names is answered whether configured or not.
 */
export function ProviderList({
  providers,
  onOpen,
}: {
  readonly providers: readonly IdentityProvider[];
  readonly onOpen: (provider: SocialProvider) => void;
}) {
  const t = useTranslations('platform.identityProviders.table');
  const columns = useProviderColumns({ onOpen });

  return <DataTable caption={t('caption')} columns={columns} rows={providers} rowKey={rowKey} />;
}
