import { ADMIN_ROSTER_KIND, type AdminRosterRow } from '@easyesg/contracts';
import { BUTTON_VARIANT, Button, type DataTableColumn } from '@easyesg/ui';
import { useMemo } from 'react';
import { useFormatter, useTranslations } from 'use-intl';
import { StandingChip } from '../shared/standing-chip';

const ROSTER_COLUMN = {
  ACCOUNT: 'account',
  REALM: 'realm',
  FACTOR: 'factor',
  LAST_SIGN_IN: 'lastSignIn',
  SUPPORT_ACCESS: 'supportAccess',
  STATE: 'state',
} as const;

type RosterColumn = (typeof ROSTER_COLUMN)[keyof typeof ROSTER_COLUMN];

/**
 * A-08's columns, as the artboard draws them (task 67.4) — the address rather than a person's name
 * (an account holds none), the realm, the second factor, the last sign-in, the support-access requests and
 * the state. **The factor column is a reading of the row's kind**: every account holds a confirmed factor by
 * construction, and only an invitation has none yet. **The support-access column is task 67.9's**: how many
 * requests each account raised in the last 30 days, whatever became of them — who leans on the privilege is
 * what reviewing it needs — and *not applicable* for an invitation, which is not yet anybody who could ask.
 *
 * Memoised on the translators and `onOpen`, which the board keeps stable — `reactCompiler` is off.
 */
export function useRosterColumns({
  onOpen,
}: {
  readonly onOpen: (id: string) => void;
}): readonly DataTableColumn<AdminRosterRow, RosterColumn>[] {
  const t = useTranslations('platform.accounts.table');
  const tRealm = useTranslations('realm.chrome.realm');
  const format = useFormatter();

  return useMemo(
    () => [
      {
        key: ROSTER_COLUMN.ACCOUNT,
        header: t('account'),
        cell: (row: AdminRosterRow) => (
          <Button type="button" variant={BUTTON_VARIANT.SUBTLE} onClick={() => onOpen(row.id)}>
            {row.email}
          </Button>
        ),
      },
      {
        key: ROSTER_COLUMN.REALM,
        header: t('realm'),
        cell: (row: AdminRosterRow) => tRealm(row.role),
      },
      {
        key: ROSTER_COLUMN.FACTOR,
        header: t('factor'),
        cell: (row: AdminRosterRow) =>
          row.kind === ADMIN_ROSTER_KIND.ACCOUNT ? t('factorEnrolled') : t('factorPending'),
      },
      {
        key: ROSTER_COLUMN.LAST_SIGN_IN,
        header: t('lastSignIn'),
        cell: (row: AdminRosterRow) =>
          row.lastSignInAt === null ? t('neverSignedIn') : format.dateTime(row.lastSignInAt, 'stamp'),
      },
      {
        key: ROSTER_COLUMN.SUPPORT_ACCESS,
        header: t('supportAccess'),
        cell: (row: AdminRosterRow) =>
          row.supportAccessRequests === null
            ? t('supportAccessNotApplicable')
            : format.number(row.supportAccessRequests, 'integer'),
      },
      {
        key: ROSTER_COLUMN.STATE,
        header: t('state'),
        cell: (row: AdminRosterRow) => <StandingChip standing={row.standing} />,
      },
    ],
    [t, tRealm, format, onOpen],
  );
}
