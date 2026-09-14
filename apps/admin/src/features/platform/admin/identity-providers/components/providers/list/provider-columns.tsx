import type { IdentityProvider, SocialProvider } from '@easyesg/contracts';
import { BUTTON_VARIANT, Button, type DataTableColumn } from '@easyesg/ui';
import { useMemo } from 'react';
import { useFormatter, useTranslations } from 'use-intl';
import { ProviderStateChip } from '../shared/provider-state-chip';

const PROVIDER_COLUMN = {
  PROVIDER: 'provider',
  STATE: 'state',
  ACCOUNTS: 'accounts',
  CHANGED: 'changed',
} as const;

type ProviderColumn = (typeof PROVIDER_COLUMN)[keyof typeof PROVIDER_COLUMN];

/**
 * A-18's columns (task 67.11; §5.2 A-18 as amended) — the provider, its state, the accounts that have linked it,
 * and its last change. **The accounts column is the one figure taken from the artboard**: it is what a disable
 * reaches, and an operator reads it before opening a record rather than after.
 *
 * Memoised on the translators, the formatter and `onOpen`, which the board keeps stable — `reactCompiler` is off.
 */
export function useProviderColumns({
  onOpen,
}: {
  readonly onOpen: (provider: SocialProvider) => void;
}): readonly DataTableColumn<IdentityProvider, ProviderColumn>[] {
  const t = useTranslations('platform.identityProviders.table');
  const tProviders = useTranslations('platform.identityProviders.providers');
  const format = useFormatter();

  return useMemo(
    () => [
      {
        key: PROVIDER_COLUMN.PROVIDER,
        header: t('provider'),
        cell: (row: IdentityProvider) => (
          <Button type="button" variant={BUTTON_VARIANT.SUBTLE} onClick={() => onOpen(row.provider)}>
            {tProviders(row.provider)}
          </Button>
        ),
      },
      {
        key: PROVIDER_COLUMN.STATE,
        header: t('state'),
        cell: (row: IdentityProvider) => <ProviderStateChip enabled={row.enabled} />,
      },
      {
        key: PROVIDER_COLUMN.ACCOUNTS,
        header: t('accounts'),
        cell: (row: IdentityProvider) => format.number(row.linkedAccounts),
      },
      {
        key: PROVIDER_COLUMN.CHANGED,
        header: t('changed'),
        cell: (row: IdentityProvider) =>
          row.changedAt === null ? t('neverChanged') : format.dateTime(row.changedAt, 'stamp'),
      },
    ],
    [t, tProviders, format, onOpen],
  );
}
