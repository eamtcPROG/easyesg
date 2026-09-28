'use client';

import { Button, BUTTON_VARIANT } from '@easyesg/ui';
import { ACCESS_MESSAGES } from '../../shared/access-messages';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { useAccess, useRowBusy } from '../../shared/access-context';
import { CONFIRMATION } from '../../../tools/access-state';
import { resendInvitationAction } from '../../../actions/actions';
import { ACCESS_ROW_KIND, isLastAdministrator, type AccessRow } from '../../../tools/access';
import { isRemindable } from '../../../tools/reminder';
import styles from '../../styles/access.module.css';

/**
 * What can be done to this row — different verbs on different objects, chosen by the union's own
 * discriminator rather than by a flag. A single actions menu parameterised by booleans is the shape
 * UX-89 warns about, and would have had to decide what "change role" means for someone who has not
 * accepted.
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

  if (row.kind === ACCESS_ROW_KIND.INVITATION) {
    return (
      <div className={styles.rowActions}>
        <Button variant={BUTTON_VARIANT.SUBTLE} disabled={busy} onClick={resend}>
          {t('resend')}
        </Button>
        <Button variant={BUTTON_VARIANT.SUBTLE} disabled={busy} onClick={confirmRevoke}>
          {t('revoke')}
        </Button>
      </div>
    );
  }

  return (
    <div className={styles.rowActions}>
      {isRemindable({ row, selfAccountId }) ? (
        <Button variant={BUTTON_VARIANT.SUBTLE} disabled={busy} onClick={() => openReminder(row.id)}>
          {t('remind')}
        </Button>
      ) : null}
      <Button
        variant={BUTTON_VARIANT.DESTRUCTIVE}
        disabled={busy || isLastAdministrator({ administrators: page.administrators, row })}
        onClick={confirmRemove}
      >
        {t('remove')}
      </Button>
    </div>
  );
}
