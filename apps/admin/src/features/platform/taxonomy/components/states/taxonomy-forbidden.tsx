import { CALLOUT_INTENT, Callout } from '@easyesg/ui';
import { useTranslations } from 'use-intl';

/** A-04's permission state: an operator whose roles hold no taxonomy permission, as the api's 403 says (task 67.13). */
export function TaxonomyForbidden() {
  const t = useTranslations('platform.taxonomy.forbidden');
  return (
    <Callout intent={CALLOUT_INTENT.ATTENTION} title={t('title')} action={null}>
      {t('body')}
    </Callout>
  );
}
