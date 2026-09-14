import type { IdentityProvider } from '@easyesg/contracts';
import { ConsequenceDialogue } from '@easyesg/ui';
import { useTranslations } from 'use-intl';
import { PROVIDER_CONTROL, type ProviderAction } from '../../../tools/provider-action-state';

/**
 * UX-70 before a disable or a save to an enabled provider (task 67.11; §5.2 A-18 as amended) — the provider named,
 * and the specific consequence. **A disable names who it reaches**: the accounts that linked the provider, that
 * nobody is signed out, and how many accounts hold no other credential and recover through a password reset
 * (UC-09). A save names that live sign-in changes within seconds.
 */
export function ProviderConfirmation({
  action,
  provider,
  busy,
  onConfirm,
  onCancel,
}: {
  readonly action: ProviderAction | null;
  /** The provider the action is about, as last read — what the counts come from. */
  readonly provider: IdentityProvider | null;
  readonly busy: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}) {
  const t = useTranslations('platform.identityProviders.confirm');
  const tProviders = useTranslations('platform.identityProviders.providers');
  const name = provider === null ? '' : tProviders(provider.provider);
  const disabling = action?.control === PROVIDER_CONTROL.DISABLE;

  return (
    <ConsequenceDialogue
      open={action !== null && provider !== null}
      object={name}
      title={disabling ? t('disable.title', { provider: name }) : t('save.title', { provider: name })}
      consequence={
        disabling
          ? t('disable.consequence', { provider: name, linked: provider?.linkedAccounts ?? 0 })
          : t('save.consequence', { provider: name })
      }
      retained={
        disabling
          ? t('disable.retained', { without: provider?.accountsWithoutOtherCredential ?? 0 })
          : t('save.retained', { provider: name })
      }
      confirmLabel={disabling ? t('disable.confirm') : t('save.confirm')}
      cancelLabel={t('cancel')}
      busy={busy}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
