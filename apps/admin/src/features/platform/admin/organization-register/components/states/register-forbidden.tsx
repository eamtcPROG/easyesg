import { CALLOUT_INTENT, Callout } from '@easyesg/ui';
import { useTranslations } from 'use-intl';

/**
 * §5.2's *error — permission* for A-02 — **the boundary explained, naming what would be required to
 * cross it** (UX-1): the register is a Platform Administrator's, and a platform administrator is who
 * can read it or change the operator's role.
 *
 * Reached by a Billing Operator who followed a link or typed the address — the navigation never
 * offers one this destination, and `AdminRealmGuard` is what refused the read. **No action**: nothing
 * on this screen can grant the role, and a button that led nowhere would be a control that cannot act.
 */
export function RegisterForbidden() {
  const t = useTranslations('platform.organizations.forbidden');

  return (
    <div className="p-[var(--space-6)]">
      <Callout intent={CALLOUT_INTENT.ATTENTION} title={t('title')} action={null}>
        {t('body')}
      </Callout>
    </div>
  );
}
