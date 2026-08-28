'use client';

import { CALLOUT_INTENT, Callout } from '@easyesg/ui';
import { useTranslations } from 'next-intl';

/**
 * §8.1's **partial** state, for one section whose read did not resolve.
 *
 * The section renders this instead of blanking the screen: a provider list that could not be
 * fetched must not hide a working password form. The retry it names is a reload, which is honest —
 * these are Server Component reads, and there is nothing on this page that could re-issue one.
 *
 * `action={null}` because the body already ends with that instruction; a second copy beneath it is
 * the duplication `Callout`'s own docblock records.
 */
export function SectionUnavailable() {
  const t = useTranslations('identity.credentials.unreachable');

  return (
    <Callout intent={CALLOUT_INTENT.ERROR} title={t('title')} action={null}>
      {t('body')}
    </Callout>
  );
}
