import { CALLOUT_INTENT, Callout } from '@easyesg/ui';
import { useTranslations } from 'use-intl';

/**
 * A-08's *error — permission* (task 67.4): a Billing Operator who followed a link here, refused by
 * `AdminRealmGuard`. It names who can read the screen, the boundary explained rather than hidden.
 */
export function RosterForbidden() {
  const t = useTranslations('platform.accounts.forbidden');

  return (
    <Callout intent={CALLOUT_INTENT.ATTENTION} title={t('title')} action={null}>
      {t('body')}
    </Callout>
  );
}
