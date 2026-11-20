import { CALLOUT_INTENT, Callout } from '@easyesg/ui';
import { useTranslations } from 'use-intl';

/**
 * A-03's *error — permission* (task 67.5): an operator whose roles hold no content permission, or a Billing Operator,
 * refused by the api. It names who edits content — the boundary explained rather than hidden.
 */
export function ContentForbidden() {
  const t = useTranslations('platform.content.forbidden');

  return (
    <Callout intent={CALLOUT_INTENT.ATTENTION} title={t('title')} action={null}>
      {t('body')}
    </Callout>
  );
}
