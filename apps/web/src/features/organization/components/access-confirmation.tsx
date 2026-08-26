'use client';

import { ConsequenceDialogue } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { CONFIRMATION, useAccess } from './access-context';
import { removeMemberAction, revokeInvitationAction } from '../actions';

/**
 * UC-61 and UC-63's confirmations — one dialogue, two consequences.
 *
 * Not two components: the anatomy is identical (UX-70's named object, the consequence, the two
 * actions) and only the sentences differ, which is what message keys are for. What is NOT shared is
 * `retained` — UX-69's "their entries stay attributed" is true of a removed member and meaningless
 * for a withdrawn invitation, since an invitation never entered anything.
 */
export function AccessConfirmation() {
  const t = useTranslations('organization.access');
  const { confirming, dismiss, perform, pendingRowKey } = useAccess();
  if (!confirming) return null;

  const { kind, row } = confirming;

  return (
    <ConsequenceDialogue
      open
      title={t(`${kind}.title`)}
      object={row.email}
      consequence={t(`${kind}.consequence`)}
      retained={kind === CONFIRMATION.REMOVE ? t('remove.retained') : undefined}
      confirmLabel={t(`${kind}.confirm`)}
      cancelLabel={t(`${kind}.cancel`)}
      busy={pendingRowKey !== null}
      onCancel={dismiss}
      onConfirm={() =>
        perform({
          row,
          action: () =>
            kind === CONFIRMATION.REMOVE
              ? removeMemberAction({ membershipId: row.id })
              : revokeInvitationAction({ invitationId: row.id }),
          success: t(`${kind}.done`, { email: row.email }),
        })
      }
    />
  );
}
