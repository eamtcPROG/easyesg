import { ADMIN_ROSTER_KIND, type AdminRosterRow } from '@easyesg/contracts';
import { COLUMN_ALIGN, type DataTableColumn } from '@easyesg/ui';
import { useMemo } from 'react';
import { useFormatter, useTranslations } from 'use-intl';
import type { AccountAction } from '../../../tools/account-action-state';
import { StandingChip } from '../shared/standing-chip';
import { RosterRowActions } from './roster-row-actions';

const ROSTER_COLUMN = {
  ACCOUNT: 'account',
  REALM: 'realm',
  FACTOR: 'factor',
  LAST_SIGN_IN: 'lastSignIn',
  SUPPORT_ACCESS: 'supportAccess',
  STATE: 'state',
  ACTIONS: 'actions',
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
 * **The last column opens the record and holds the row's lifecycle** (task 170; §5.2's preamble):
 * `roster-row-actions.tsx`. The address has been plain text since — until then it was the opener, a
 * link-coloured button, and nothing on the row said what else could be done with it.
 *
 * Memoised on the translators and the callbacks, which the board keeps stable, and on the two primitives
 * the menu reads — `reactCompiler` is off (AD-9).
 */
export function useRosterColumns({
  operatorId,
  busy,
  onOpen,
  onControl,
}: {
  readonly operatorId: string;
  /** A control is in flight — the menus' items are disabled until it settles. */
  readonly busy: boolean;
  readonly onOpen: (id: string) => void;
  readonly onControl: (action: AccountAction) => void;
}): readonly DataTableColumn<AdminRosterRow, RosterColumn>[] {
  const t = useTranslations('platform.accounts.table');
  const tRealm = useTranslations('realm.chrome.realm');
  const tChrome = useTranslations('chrome.rowActions');
  const format = useFormatter();

  return useMemo(
    () => [
      {
        key: ROSTER_COLUMN.ACCOUNT,
        header: t('account'),
        cell: (row: AdminRosterRow) => <span className="t-body-strong">{row.email}</span>,
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
      {
        key: ROSTER_COLUMN.ACTIONS,
        header: tChrome('header'),
        align: COLUMN_ALIGN.END,
        cell: (row: AdminRosterRow) => (
          <RosterRowActions
            row={row}
            operatorId={operatorId}
            busy={busy}
            onOpen={onOpen}
            onControl={onControl}
          />
        ),
      },
    ],
    [t, tRealm, tChrome, format, operatorId, busy, onOpen, onControl],
  );
}
