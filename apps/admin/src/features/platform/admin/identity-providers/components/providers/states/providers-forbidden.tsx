import { CALLOUT_INTENT, Callout } from '@easyesg/ui';
import { useTranslations } from 'use-intl';

/**
 * A-18's *error — permission* (task 67.11): a Billing Operator who followed a link here, refused by
 * `AdminRealmGuard`. It names who configures providers — the boundary explained rather than hidden.
 */
export function ProvidersForbidden() {
  const t = useTranslations('platform.identityProviders.forbidden');

  return (
    <Callout intent={CALLOUT_INTENT.ATTENTION} title={t('title')} action={null}>
      {t('body')}
    </Callout>
  );
}
