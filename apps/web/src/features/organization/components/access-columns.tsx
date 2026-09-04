'use client';

import { StatusChip, type DataTableColumn, type StatusTone } from '@easyesg/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { useMemo } from 'react';
import {
  ACCESS_COLUMN,
  ACCESS_ROW_KIND,
  ACCESS_STANDING,
  accessStanding,
  type AccessColumnKey,
  type AccessRow,
  type AccessStanding,
} from '../access';
import { RoleCell, RowActions } from './access-row';

/**
 * S-16's four columns and its action column.
 *
 * **The table's columns, not the screen's.** They live here rather than inline in the list because
 * they are the one part of the Index that is genuinely about *this* data — how a standing becomes a
 * chip, how an instant becomes a sentence — and reading that beside the table's markup buried both.
 *
 * The two cells that act (`RoleCell`, `RowActions`) take only the row: everything else reaches them
 * through `useAccess()`. That is what removed five props from one and four from the other, and it
 * is why this hook has no parameters at all.
 */

/**
 * `attention` for a lapsed invitation is the one non-obvious mapping, and it is the reason the tone
 * exists: an expired invitation is not an error the reader made, it is a thing that has quietly
 * stopped working and wants a resend. `error` would overstate it; `pending` would hide it.
 */
const STANDING_TONE: Record<AccessStanding, StatusTone> = {
  [ACCESS_STANDING.ACTIVE]: 'positive',
  [ACCESS_STANDING.INVITED]: 'pending',
  [ACCESS_STANDING.INVITATION_EXPIRED]: 'attention',
};

export function useAccessColumns(
  now: number,
): readonly DataTableColumn<AccessRow, AccessColumnKey>[] {
  const t = useTranslations('organization.access');
  const format = useFormatter();

  // Memoised on the three things that can actually change it: the clock the standings are judged
  // against, and the two locale-bound helpers. Without it the array is a new object every render
  // and `DataTable` re-renders its whole body on any state change in the provider.
  return useMemo(
    () => [
      {
        key: ACCESS_COLUMN.PERSON,
        header: t('columns.person'),
        sortable: true,
        cell: (row: AccessRow) => row.email,
      },
      {
        key: ACCESS_COLUMN.ROLE,
        header: t('columns.role'),
        sortable: true,
        cell: (row: AccessRow) => <RoleCell row={row} />,
      },
      {
        key: ACCESS_COLUMN.STANDING,
        header: t('columns.standing'),
        sortable: true,
        cell: (row: AccessRow) => {
          const standing = accessStanding(row, now);
          return (
            <StatusChip tone={STANDING_TONE[standing]}>{t(`standings.${standing}`)}</StatusChip>
          );
        },
      },
      {
        key: ACCESS_COLUMN.ACTIVITY,
        header: t('columns.activity'),
        sortable: true,
        cell: (row: AccessRow) => activityText({ row, now, t, format }),
      },
      {
        key: ACCESS_COLUMN.ACTIONS,
        header: t('columns.actions'),
        cell: (row: AccessRow) => <RowActions row={row} />,
      },
    ],
    [format, now, t],
  );
}

/**
 * One column, three sentences — and which one depends on what the row *is*, not on a null.
 *
 * A member who has never signed in gets a sentence rather than a dash: "not signed in yet" is a
 * fact about a person, where an em-dash is a fact about the data. An invitation has no activity at
 * all, so the column says what did happen to it — sent, or lapsed.
 */
function activityText({
  row,
  now,
  t,
  format,
}: {
  readonly row: AccessRow;
  readonly now: number;
  readonly t: ReturnType<typeof useTranslations<'organization.access'>>;
  readonly format: ReturnType<typeof useFormatter>;
}): string {
  if (row.kind === ACCESS_ROW_KIND.MEMBER) {
    return row.lastActiveAt === null
      ? t('activity.never')
      : t('activity.lastActive', { date: format.dateTime(row.lastActiveAt, 'short') });
  }
  return accessStanding(row, now) === ACCESS_STANDING.INVITATION_EXPIRED
    ? t('activity.expiredOn', { date: format.dateTime(row.expiresAt, 'short') })
    : t('activity.invited', { date: format.dateTime(row.issuedAt, 'short') });
}
