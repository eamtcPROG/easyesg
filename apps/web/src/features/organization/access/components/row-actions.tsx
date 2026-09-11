'use client';

import { Button, BUTTON_VARIANT } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { useAccess, useRowBusy } from './access-context';
import { CONFIRMATION } from '../tools/access-state';
import { resendInvitationAction } from '../actions/actions';
import { ACCESS_ROW_KIND, isLastAdministrator, type AccessRow } from '../tools/access';
import styles from './access.module.css';

/**
 * What can be done to this row — different verbs on different objects, chosen by the union's own
 * discriminator rather than by a flag. A single actions menu parameterised by booleans is the shape
 * UX-89 warns about, and would have had to decide what "change role" means for someone who has not
 * accepted.
 */
export function RowActions({ row }: { readonly row: AccessRow }) {
  const t = useTranslations('organization.access.actions');
  const tAccess = useTranslations('organization.access');
  const { page, ask, perform } = useAccess();
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
