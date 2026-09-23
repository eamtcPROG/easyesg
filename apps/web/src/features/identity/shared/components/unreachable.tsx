import { getTranslations } from 'next-intl/server';
import { Callout, CALLOUT_INTENT } from '@easyesg/ui';

/**
 * **In `identity/shared/components/` on one test — read by more than one screen:** S-03 and, since task 52.2.2, S-38,
 * each drawing it when the read of its emailed link got no answer.
 *
 * Not a fact about the link, so it says so — the link is probably still good.
 */
export async function Unreachable() {
  const t = await getTranslations('identity');

  return (
    <Callout intent={CALLOUT_INTENT.ERROR} title={t('unreachable.title')} action={t('unreachable.action')}>
      {t('unreachable.body')}
    </Callout>
  );
}
