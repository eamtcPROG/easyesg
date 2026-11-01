import type { IdentityProvider, SocialProvider } from '@easyesg/contracts';
import { DataTable } from '@easyesg/ui';
import { useTranslations } from 'use-intl';
import type { ProviderAction } from '../../../tools/provider-action-state';
import { useProviderColumns } from './provider-columns';

/** Hoisted, so the table receives the same function every render. */
const rowKey = (row: IdentityProvider): string => row.provider;

/**
 * A-18's providers (task 67.11). **A table, not an Index**: the providers are read whole, with nothing to page,
 * search or filter — and never empty, since every provider FR-2 names is answered whether configured or not.
 *
 * **It says how many rows it holds, beneath the table** (task 170; `design_spec.md` §5.2's preamble): a list the api
 * answers whole has no pager to state its position, so the count is the line that tells an operator the table is all
 * there is.
 */
export function ProviderList({
  providers,
  pending,
  onOpen,
  onRequest,
}: {
  readonly providers: readonly IdentityProvider[];
  readonly pending: ProviderAction | null;
  readonly onOpen: (provider: SocialProvider) => void;
  readonly onRequest: (action: ProviderAction) => void;
}) {
  const t = useTranslations('platform.identityProviders.table');
  const columns = useProviderColumns({ pending, onOpen, onRequest });

  return (
    <div className="flex min-w-0 flex-col gap-[var(--space-2)]">
      <DataTable caption={t('caption')} columns={columns} rows={providers} rowKey={rowKey} />
      <p className="t-caption text-[var(--text-muted)]">{t('count', { count: providers.length })}</p>
    </div>
  );
}
