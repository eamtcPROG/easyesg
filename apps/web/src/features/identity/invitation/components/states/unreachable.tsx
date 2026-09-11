import { getTranslations } from 'next-intl/server';
import { Callout, CALLOUT_INTENT } from '@easyesg/ui';

/** Not a fact about the invitation, so it says so — the link is probably still good. */
export async function Unreachable() {
  const t = await getTranslations('identity');

  return (
    <Callout intent={CALLOUT_INTENT.ERROR} title={t('unreachable.title')} action={t('unreachable.action')}>
      {t('unreachable.body')}
    </Callout>
  );
}
