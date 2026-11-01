import type { AdminRole } from '@easyesg/contracts';
import { Fragment, useId } from 'react';
import { useTranslations } from 'use-intl';
import { REALM_POWER_HOLDING, realmPowersOf } from '../../../tools/realm-powers';

/**
 * What the record's realm may do (task 67.4) — the artboard's *powers, by realm and not by person*.
 * Descriptive: `AdminRealmGuard` is what refuses, and `realm-powers.ts` says why the table is the
 * whole of it until the Platform Administrator role gains levels.
 */
export function AccountPowers({ role }: { readonly role: AdminRole }) {
  const t = useTranslations('platform.accounts');
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-[var(--space-2)]">
      <h3 id={titleId} className="t-body font-semibold">
        {t('record.powersTitle')}
      </h3>
      <p className="t-caption text-[var(--text-muted)]">{t('record.powersLede')}</p>
      <dl className="t-caption grid grid-cols-[1fr_auto] gap-x-[var(--space-4)] gap-y-[var(--space-1)]">
        {realmPowersOf(role).map(({ power, holding }) => (
          <Fragment key={power}>
            <dt>{t(`powers.${power}`)}</dt>
            <dd className="text-right">
              {holding === REALM_POWER_HOLDING.NOBODY
                ? t('record.nobody')
                : holding === REALM_POWER_HOLDING.HELD
                  ? t('record.yes')
                  : t('record.no')}
            </dd>
          </Fragment>
        ))}
      </dl>
    </section>
  );
}
