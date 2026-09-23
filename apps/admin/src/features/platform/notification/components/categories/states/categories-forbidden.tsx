import { CALLOUT_INTENT, Callout } from '@easyesg/ui';
import { useTranslations } from 'use-intl';

/**
 * A-17's *error — permission* (task 67.10): a Billing Operator who followed a link here, refused by `AdminRealmGuard`.
 * It names who configures notifications — the boundary explained rather than hidden.
 */
export function CategoriesForbidden() {
  const t = useTranslations('platform.notificationCategories.forbidden');

  return (
    <Callout intent={CALLOUT_INTENT.ATTENTION} title={t('title')} action={null}>
      {t('body')}
    </Callout>
  );
}
