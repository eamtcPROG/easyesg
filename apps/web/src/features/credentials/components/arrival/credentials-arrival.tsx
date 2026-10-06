'use client';

import { CALLOUT_INTENT, Callout, TextLink } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { LocalizedPath } from '@/lib/locale-path';
import type { CredentialsArrival as Arrival } from '../../tools/credentials-arrival';
import { SECTION_READ } from '../../tools/credentials';
import { useCredentials } from '../shared/credentials-context';
import { ARRIVAL_MESSAGES } from '../shared/credentials-messages';

/**
 * S-28's arrival notice — UC-195 step 3, said where the reader lands after a recovery sign-in (task 190;
 * `design_spec.md` S-28's *arrival — recovered* state; `architecture.md` §12.5.6's task-190 row (1)).
 *
 * **The count is this screen's own read**, the same one the second factor's row shows, so the two cannot disagree and
 * the address carries no number. At zero it is a warning that says what zero means, because UC-195 makes exhaustion a
 * designed state the reader is told about before it bites; and where the read failed, it says the code was spent and
 * where the count would be, rather than guessing one.
 *
 * **Its one action is the way on** (owner, 6 Oct 2026): the destination the sign-in would have reached — §4.3's, or
 * the `?return=` it was carrying — so an invitee keeps the way back to their invitation and a reader whose session
 * ended keeps theirs (FR-11, FR-5, UX-38). Turning the factor off and re-issuing stay in the row just below, and a
 * second control for the same act would be the duplicate S-01's conflict callout was corrected for.
 */
export function CredentialsArrival({
  arrival,
  onward,
}: {
  readonly arrival: Arrival | null;
  readonly onward: LocalizedPath | null;
}) {
  const t = useTranslations(ARRIVAL_MESSAGES);
  const { read } = useCredentials();
  if (arrival === null) return null;

  const action =
    onward === null ? null : (
      <TextLink asChild>
        <Link href={onward.href} {...(onward.locale ? { locale: onward.locale } : {})}>
          {t('onward')}
        </Link>
      </TextLink>
    );

  if (read.factor.status !== SECTION_READ.READY) {
    return (
      <Callout intent={CALLOUT_INTENT.INFO} title={t('title')} action={action}>
        {t('bodyUnread')}
      </Callout>
    );
  }

  const remaining = read.factor.value.recoveryCodesRemaining;
  return remaining === 0 ? (
    <Callout intent={CALLOUT_INTENT.WARNING} title={t('title')} action={action}>
      {t('bodyNone')}
    </Callout>
  ) : (
    <Callout intent={CALLOUT_INTENT.INFO} title={t('title')} action={action}>
      {t('body', { remaining })}
    </Callout>
  );
}
