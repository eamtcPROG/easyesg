'use client';

import { OverflowMenu } from '@easyesg/ui';
import { ACCESS_MESSAGES } from '../../shared/access-messages';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { useAccess, useRowBusy } from '../../shared/access-context';
import { CONFIRMATION } from '../../../tools/access-state';
import { resendInvitationAction } from '../../../actions/actions';
import { ACCESS_ROW_KIND, isLastAdministrator, type AccessRow } from '../../../tools/access';
import { isRemindable } from '../../../tools/reminder';

/**
 * What can be done to this row — different verbs on different objects, chosen by the union's own
 * discriminator rather than by a flag. A single actions menu parameterised by booleans is the shape
 * UX-89 warns about, and would have had to decide what "change role" means for someone who has not
 * accepted. **Since 19 Oct 2026 (project owner) the verbs are the items of one ⋯** named for the row's
 * address, as every tenant table's row actions are; the menu is still built per kind, so each kind
 * still says only its own verbs. Withdrawing is set apart below the rule as the destructive item, and
 * an item that opens a dialogue ends in an ellipsis.
 *
 * **A member may be reminded from their row** (28 Sep 2026, project owner): *remind* opens the
 * reminder's dialogue with them chosen. It is on every row `isRemindable` admits — an active member who
 * is not the reader — whether or not a report is open, and the dialogue says when none is.
 */
export function RowActions({ row }: { readonly row: AccessRow }) {
  const t = useTranslations(`${ACCESS_MESSAGES}.actions`);
  const tAccess = useTranslations(ACCESS_MESSAGES);
  const { page, ask, perform, openReminder, selfAccountId } = useAccess();
  const busy = useRowBusy(row);

  const resend = useCallback(
    () =>
      perform({
        row,
        action: () => resendInvitationAction({ invitationId: row.id }),
        success: tAccess('resent', { email: row.email }),
      }),
    [perform, row, tAccess],
  );

  const confirmRevoke = useCallback(
    () => ask({ kind: CONFIRMATION.REVOKE, row }),
    [ask, row],
  );
  const confirmRemove = useCallback(
    () => ask({ kind: CONFIRMATION.REMOVE, row }),
    [ask, row],
  );

  const label = t('menu', { email: row.email });

  if (row.kind === ACCESS_ROW_KIND.INVITATION) {
    return (
      <OverflowMenu
        label={label}
        items={[
          { key: 'resend', label: t('resend'), onSelect: resend, disabled: busy },
          { key: 'revoke', label: t('revoke'), onSelect: confirmRevoke, disabled: busy, destructive: true },
        ]}
      />
    );
  }

  // The last administrator cannot be removed; the item stays, disabled and saying why, rather than vanishing.
  const last = isLastAdministrator({ administrators: page.administrators, row });
  return (
    <OverflowMenu
      label={label}
      items={[
        ...(isRemindable({ row, selfAccountId })
          ? [{ key: 'remind', label: t('remind'), onSelect: () => openReminder(row.id), disabled: busy }]
          : []),
        {
          key: 'remove',
          label: last ? t('removeLast') : t('remove'),
          onSelect: confirmRemove,
          disabled: busy || last,
          destructive: true,
        },
      ]}
    />
  );
}
