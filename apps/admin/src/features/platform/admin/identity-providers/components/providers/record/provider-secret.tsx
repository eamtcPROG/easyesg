import type { IdentityProvider } from '@easyesg/contracts';
import { useId } from 'react';
import { useTranslations } from 'use-intl';

/**
 * The half of a provider A-18 cannot edit (task 67.11; the task row's *"must say which is which"*): whether the
 * server holds the client secret, the setting that holds it, and that a change to it takes a restart. **The
 * setting's name is shown as a reference an operator types**, not as jargon to decode — it comes from the api,
 * which reads the secret from it, so the two cannot name different variables. Task 154 moves the secret into
 * OpenBao, and this group's sentence changes with it. Its two facts stack below `sm`, as the record's others do
 * (UX-77 as amended, task 170).
 */
export function ProviderSecret({ provider }: { readonly provider: IdentityProvider }) {
  const t = useTranslations('platform.identityProviders.secret');
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-[var(--space-2)]">
      <h3 id={titleId} className="t-body-strong">
        {t('title')}
      </h3>
      <dl className="t-body grid grid-cols-1 gap-y-[var(--space-1)] max-sm:[&>dt:not(:first-of-type)]:mt-[var(--space-3)] sm:grid-cols-[auto_1fr] sm:items-center sm:gap-x-[var(--space-4)] sm:gap-y-[var(--space-2)]">
        <dt className="text-[var(--text-muted)]">{t('standing')}</dt>
        <dd>{provider.secretHeld ? t('held') : t('notHeld')}</dd>
        <dt className="text-[var(--text-muted)]">{t('setting')}</dt>
        <dd>
          <code className="break-all">{provider.secretSetting}</code>
        </dd>
      </dl>
      <p className="t-caption text-[var(--text-muted)]">{t('note')}</p>
    </section>
  );
}
