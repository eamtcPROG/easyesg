import type { IdentityProvider, SocialProvider } from '@easyesg/contracts';
import { COLUMN_ALIGN, type DataTableColumn } from '@easyesg/ui';
import { useMemo } from 'react';
import { useFormatter, useTranslations } from 'use-intl';
import { ROW_OPENS, RowActions } from '~/shared/row-actions';
import {
  PROVIDER_CONTROL,
  stateControlOf,
  type ProviderAction,
} from '../../../tools/provider-action-state';
import { ProviderStateChip } from '../shared/provider-state-chip';

const PROVIDER_COLUMN = {
  PROVIDER: 'provider',
  STATE: 'state',
  ACCOUNTS: 'accounts',
  CHANGED: 'changed',
  ACTIONS: 'actions',
} as const;

type ProviderColumn = (typeof PROVIDER_COLUMN)[keyof typeof PROVIDER_COLUMN];

/**
 * A-18's columns (task 67.11; §5.2 A-18 as amended) — the provider, its state, the accounts that have linked it,
 * and its last change. **The accounts column is the one figure taken from the artboard**: it is what a disable
 * reaches, and an operator reads it before opening a record rather than after.
 *
 * **The last column opens the record and holds the row's one action** (task 170; `design_spec.md` §5.2's preamble):
 * *Editați*, since every provider's record holds its connection form, and ⋯ with the enable or disable the record's
 * state control also offers — asked of `stateControlOf`, so a blocked enable is unavailable here for the reason the
 * record states, and a disable goes through the board's `request` and confirms exactly as the record's does. **The
 * name is plain text**: until task 170 it was the opener, a link-coloured button nothing else on the row explained.
 *
 * Memoised on the translators, the formatter, the two callbacks the board keeps stable and the write in flight —
 * `reactCompiler` is off (AD-9).
 */
export function useProviderColumns({
  pending,
  onOpen,
  onRequest,
}: {
  readonly pending: ProviderAction | null;
  readonly onOpen: (provider: SocialProvider) => void;
  readonly onRequest: (action: ProviderAction) => void;
}): readonly DataTableColumn<IdentityProvider, ProviderColumn>[] {
  const t = useTranslations('platform.identityProviders.table');
  const tMenu = useTranslations('platform.identityProviders.menu');
  const tProviders = useTranslations('platform.identityProviders.providers');
  const tChrome = useTranslations('chrome.rowActions');
  const format = useFormatter();

  return useMemo(
    () => [
      {
        key: PROVIDER_COLUMN.PROVIDER,
        header: t('provider'),
        cell: (row: IdentityProvider) => <span className="t-body-strong">{tProviders(row.provider)}</span>,
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
      {
        key: PROVIDER_COLUMN.ACTIONS,
        header: tChrome('header'),
        align: COLUMN_ALIGN.END,
        cell: (row: IdentityProvider) => {
          const { action, blocked } = stateControlOf(row);
          return (
            <RowActions
              name={tProviders(row.provider)}
              opens={ROW_OPENS.EDIT}
              onOpen={() => onOpen(row.provider)}
              items={[
                {
                  key: action.control,
                  label: tMenu(action.control),
                  destructive: action.control === PROVIDER_CONTROL.DISABLE,
                  disabled: pending !== null || blocked,
                  onSelect: () => onRequest(action),
                },
              ]}
            />
          );
        },
      },
    ],
    [t, tMenu, tProviders, tChrome, format, pending, onOpen, onRequest],
  );
}
