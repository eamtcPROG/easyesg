import { CALLOUT_INTENT, Callout } from '@easyesg/ui';
import { useTranslations } from 'use-intl';

/**
 * A-21's *error — permission* (task 75): a Billing Operator who followed a link here, refused by `AdminRealmGuard`. It
 * names who keeps the operator's details — the boundary explained rather than hidden.
 */
export function LegalControllerForbidden() {
  const t = useTranslations('platform.legalController.forbidden');

  return (
    <Callout intent={CALLOUT_INTENT.ATTENTION} title={t('title')} action={null}>
      {t('body')}
    </Callout>
  );
}
