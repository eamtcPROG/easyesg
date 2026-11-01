import { Callout, CALLOUT_INTENT } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { PROFILE_MESSAGES } from '../shared/profile-messages';

/** S-27's **error — recoverable** for the read: either resource unanswered, so there is no record to draw (task 52.3). */
export async function ProfileUnreachable() {
  const t = await getTranslations(PROFILE_MESSAGES);

  return (
    <Callout intent={CALLOUT_INTENT.ERROR} title={t('unreachable.title')} action={t('unreachable.action')}>
      {t('unreachable.body')}
    </Callout>
  );
}
