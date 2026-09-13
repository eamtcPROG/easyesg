'use client';

import { StatusChip, STATUS_TONE, type DataTableColumn, type StatusTone } from '@easyesg/ui';
import { ACCESS_MESSAGES } from '../../shared/access-messages';
import { useFormatter, useTranslations } from 'next-intl';
import { useMemo } from 'react';
import {
  ACCESS_COLUMN,
  ACCESS_ROW_KIND,
  ACCESS_STANDING,
  type AccessColumnKey,
  type AccessRow,
  type AccessStanding,
} from '../../../tools/access';
import { PersonCell } from './person-cell';
import { RoleCell } from './role-cell';
import { RowActions } from './row-actions';

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
  [ACCESS_STANDING.ACTIVE]: STATUS_TONE.POSITIVE,
  [ACCESS_STANDING.INVITED]: STATUS_TONE.PENDING,
  [ACCESS_STANDING.INVITATION_EXPIRED]: STATUS_TONE.ATTENTION,
};

export function useAccessColumns(): readonly DataTableColumn<AccessRow, AccessColumnKey>[] {
  const t = useTranslations(ACCESS_MESSAGES);
  const format = useFormatter();

  // Memoised on the two things that can actually change it, both locale-bound. Without it the
  // array is a new object every render and `DataTable` re-renders its whole body on any state
  // change in the provider. **The clock was the third until task 131** — the standing is the
  // server's now, so this hook no longer depends on when it ran.
  return useMemo(
    () => [
      {
        key: ACCESS_COLUMN.PERSON,
        header: t('columns.person'),
        sortable: true,
        // **Sorted by what this cell leads with, which is the server's business rather than this
        // file's.** `ORDER BY` runs over the same derived column the row carries (task 140), so
        // ascending here means ascending by the name a reader sees — the defect the `standing`
        // column already records one row down, where a value drawn in the browser and filtered in
        // the database would be two evaluations of one fact.
        cell: (row: AccessRow) => <PersonCell row={row} />,
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
        // The server derived it, in the statement that filtered on it (task 131). Reading it off
        // the row is what makes "admitted as invited" and "drawn as invited" the same fact rather
        // than two evaluations that agree most of the time.
        cell: (row: AccessRow) => (
          <StatusChip tone={STANDING_TONE[row.standing]}>{t(`standings.${row.standing}`)}</StatusChip>
        ),
      },
      {
        key: ACCESS_COLUMN.ACTIVITY,
        header: t('columns.activity'),
        sortable: true,
        cell: (row: AccessRow) => activityText({ row, t, format }),
      },
      {
        key: ACCESS_COLUMN.ACTIONS,
        header: t('columns.actions'),
        cell: (row: AccessRow) => <RowActions row={row} />,
      },
    ],
    [format, t],
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
  t,
  format,
}: {
  readonly row: AccessRow;
  readonly t: ReturnType<typeof useTranslations<'organization.access'>>;
  readonly format: ReturnType<typeof useFormatter>;
}): string {
  if (row.kind === ACCESS_ROW_KIND.MEMBER) {
    return row.lastActiveAt === null
      ? t('activity.never')
      : t('activity.lastActive', { date: format.dateTime(row.lastActiveAt, 'short') });
  }
  return row.standing === ACCESS_STANDING.INVITATION_EXPIRED
    ? t('activity.expiredOn', { date: format.dateTime(row.expiresAt, 'short') })
    : t('activity.invited', { date: format.dateTime(row.issuedAt, 'short') });
}
