import { CALLOUT_INTENT, Callout } from '@easyesg/ui';
import { useTranslations } from 'use-intl';

/** A-05's permission state: an operator whose roles hold no rules permission, as the api's 403 says (task 67.13). */
export function RulesForbidden() {
  const t = useTranslations('platform.rules.forbidden');
  return (
    <Callout intent={CALLOUT_INTENT.ATTENTION} title={t('title')} action={null}>
      {t('body')}
    </Callout>
  );
}
