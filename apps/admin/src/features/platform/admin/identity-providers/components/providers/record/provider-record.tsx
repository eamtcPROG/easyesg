import type { IdentityProvider } from '@easyesg/contracts';
import { BUTTON_VARIANT, Button, Panel } from '@easyesg/ui';
import { useTranslations } from 'use-intl';
import type { ProviderAction } from '../../../tools/provider-action-state';
import { ProviderSettingsForm } from '../form/provider-settings-form';
import { ProviderFacts } from './provider-facts';
import { ProviderSecret } from './provider-secret';
import { ProviderStateControl } from './provider-state-control';

/**
 * A-18's record (task 67.11) — §4.6's Record for one provider: its identity header, its facts, the two halves of
 * its configuration each in its own group — **the secret, which this screen reports on and cannot edit, above the
 * connection it can** — its state control, and change attribution among the facts.
 *
 * **The form is keyed by the revision it was opened on**, so a save, or a colleague's save the api refused this
 * one over, remounts it with the values now in force rather than leaving an edited copy of values that are stale.
 */
export function ProviderRecord({
  provider,
  pending,
  onAction,
  onClose,
}: {
  readonly provider: IdentityProvider;
  readonly pending: ProviderAction | null;
  readonly onAction: (action: ProviderAction) => void;
  readonly onClose: () => void;
}) {
  const t = useTranslations('platform.identityProviders.record');
  const tProviders = useTranslations('platform.identityProviders.providers');
  const name = tProviders(provider.provider);

  return (
    <aside aria-label={t('region', { provider: name })}>
      <Panel className="flex flex-col gap-[var(--space-5)] p-[var(--space-5)]">
        <h2 className="t-heading-3">{name}</h2>

        <ProviderFacts provider={provider} />
        <ProviderStateControl provider={provider} pending={pending} onAction={onAction} />
        <ProviderSecret provider={provider} />
        <ProviderSettingsForm
          key={`${provider.provider}:${String(provider.revision)}`}
          provider={provider}
          pending={pending}
          onAction={onAction}
        />

        <div>
          <Button type="button" variant={BUTTON_VARIANT.SUBTLE} onClick={onClose}>
            {t('close')}
          </Button>
        </div>
      </Panel>
    </aside>
  );
}
