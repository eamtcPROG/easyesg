import { ADMIN_STANDING, type AdminStanding } from '@easyesg/contracts';
import { STATUS_TONE, StatusChip, type StatusTone } from '@easyesg/ui';
import { useTranslations } from 'use-intl';

/**
 * **Admission test** (`shared-admission-test`): read by more than one part of the account region —
 * the table's state column and the record — and by nothing outside it.
 *
 * A row's state as a chip (task 67.4). **Tones are semantic**: only an active account is settled and
 * good; a lock, a suspension and a lapsed link each ask something of an operator; an invitation is in
 * flight; a removal is settled and asks nothing more.
 */
const TONE: Readonly<Record<AdminStanding, StatusTone>> = {
  [ADMIN_STANDING.ACTIVE]: STATUS_TONE.POSITIVE,
  [ADMIN_STANDING.LOCKED]: STATUS_TONE.ATTENTION,
  [ADMIN_STANDING.SUSPENDED]: STATUS_TONE.ATTENTION,
  [ADMIN_STANDING.REMOVED]: STATUS_TONE.NEUTRAL,
  [ADMIN_STANDING.INVITED]: STATUS_TONE.PENDING,
  [ADMIN_STANDING.LAPSED]: STATUS_TONE.ATTENTION,
};

export function StandingChip({ standing }: { readonly standing: AdminStanding }) {
  const t = useTranslations('platform.accounts.standing');
  return <StatusChip tone={TONE[standing]}>{t(standing)}</StatusChip>;
}
