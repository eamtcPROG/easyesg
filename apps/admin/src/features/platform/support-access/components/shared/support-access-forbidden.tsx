import { CALLOUT_INTENT, Callout } from '@easyesg/ui';
import { useTranslations } from 'use-intl';

/**
 * A-07's *error — permission* (task 67.9): a Billing Operator who followed a link here, refused by
 * `AdminRealmGuard`. It names who can use the screen — the boundary explained rather than hidden.
 *
 * **In `components/shared/` on its readers**: the in-progress section, which speaks for the screen's refusals, and
 * the grant region's shared failure, which meets the same 403 on a read.
 */
export function SupportAccessForbidden() {
  const t = useTranslations('platform.supportAccess.forbidden');

  return (
    <Callout intent={CALLOUT_INTENT.ATTENTION} title={t('title')} action={null}>
      {t('body')}
    </Callout>
  );
}
