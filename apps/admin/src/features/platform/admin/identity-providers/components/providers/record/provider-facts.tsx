import type { IdentityProvider } from '@easyesg/contracts';
import { useFormatter, useTranslations } from 'use-intl';
import { ProviderStateChip } from '../shared/provider-state-chip';

/**
 * A-18's facts about one provider (task 67.11) — its state, who a withdrawal reaches, what it asks the provider
 * for, and its last change. **The scopes are stated, not offered** (UC-70 amended): FR-2's three are fixed, and a
 * control for them would be a choice that does not exist.
 */
export function ProviderFacts({ provider }: { readonly provider: IdentityProvider }) {
  const t = useTranslations('platform.identityProviders.record');
  const format = useFormatter();

  return (
    <dl className="t-body grid grid-cols-[auto_1fr] items-center gap-x-[var(--space-4)] gap-y-[var(--space-2)]">
      <dt className="text-[var(--text-muted)]">{t('state')}</dt>
      <dd>
        <ProviderStateChip enabled={provider.enabled} />
      </dd>

      <dt className="text-[var(--text-muted)]">{t('accounts')}</dt>
      <dd>{t('accountsValue', { count: provider.linkedAccounts })}</dd>

      <dt className="text-[var(--text-muted)]">{t('withoutOther')}</dt>
      <dd>{t('accountsValue', { count: provider.accountsWithoutOtherCredential })}</dd>

      <dt className="text-[var(--text-muted)]">{t('scopes')}</dt>
      <dd className="flex flex-col gap-[var(--space-1)]">
        <span>{t('scopesValue')}</span>
        <span className="t-caption text-[var(--text-muted)]">{t('scopesNote')}</span>
      </dd>

      <dt className="text-[var(--text-muted)]">{t('changed')}</dt>
      <dd>
        {provider.changedAt === null
          ? t('neverChanged')
          : provider.changedByEmail === null
            ? t('changedWithoutOperator', { time: format.dateTime(provider.changedAt, 'stamp') })
            : t('changedBy', { email: provider.changedByEmail, time: format.dateTime(provider.changedAt, 'stamp') })}
      </dd>
    </dl>
  );
}
