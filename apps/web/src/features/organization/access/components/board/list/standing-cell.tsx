'use client';

import { StatusChip, STATUS_TONE, type StatusTone } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { ACCESS_STANDING, type AccessRow, type AccessStanding } from '../../../tools/access';
import { ACCESS_MESSAGES } from '../../shared/access-messages';

const STANDING_TONE: Record<AccessStanding, StatusTone> = {
  [ACCESS_STANDING.ACTIVE]: STATUS_TONE.POSITIVE,
  [ACCESS_STANDING.INVITED]: STATUS_TONE.PENDING,
  [ACCESS_STANDING.INVITATION_EXPIRED]: STATUS_TONE.ATTENTION,
};

/**
 * The standing column: where a row sits in the access lifecycle, and — since task 51.4 — whether its
 * address still reaches anyone.
 *
 * **Two chips, not one, because they answer different questions** (FR-171; §12.5.6's task-51.4 row).
 * A standing is one of three and exactly one is true; suppression cuts across all three. Folding it in
 * would force *invited* and *undeliverable* to be a choice, and the row that most needs saying — an
 * invitation to a mailbox that hard-bounced, whose acceptance can never arrive — is precisely the one
 * that says both.
 *
 * **Both are read off the row, never recomputed** (task 131's rule): the server derived the standing in
 * the statement that filtered on it, and only the api can see the suppression list at all.
 */
export function StandingCell({ row }: { readonly row: AccessRow }) {
  const t = useTranslations(ACCESS_MESSAGES);

  return (
    <>
      <StatusChip tone={STANDING_TONE[row.standing]}>{t(`standings.${row.standing}`)}</StatusChip>
      {row.emailSuppressed ? <StatusChip tone={STATUS_TONE.ATTENTION}>{t('suppressed')}</StatusChip> : null}
    </>
  );
}
