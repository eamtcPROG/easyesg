import type { IdentityProvider } from '@easyesg/contracts';
import { BUTTON_VARIANT, Button, Dialog } from '@easyesg/ui';
import type { ReactNode } from 'react';
import { useTranslations } from 'use-intl';
import type { ProviderAction } from '../../../tools/provider-action-state';
import { ProviderFacts } from './provider-facts';
import { ProviderSecret } from './provider-secret';
import { ProviderSettingsForm } from './provider-settings-form';
import { ProviderStateControl } from './provider-state-control';

/**
 * A-18's record (task 67.11) — §4.6's Record for one provider: its identity header, its facts, the two halves of
 * its configuration each in its own group — **the secret, which this screen reports on and cannot edit, above the
 * connection it can** — its state control, and change attribution among the facts.
 *
 * **In a dialogue over the providers since task 170** (`design_spec.md` §5.2's preamble; the project owner named
 * this one: *"identity-providers details/edit form should open in dialog"*). It was a panel beside the table, which
 * narrowed the table by its own width and had no room at all below `wide`. The dialogue's title is the provider's
 * name, which is the identity header; the confirmation a disable or a live save asks for opens over it.
 *
 * **The notice arrives as a slot**, rendered above the record: the board owns the action state and decides where its
 * notice is drawn, and while the dialogue is open that is here — the page behind a modal dialogue is hidden from
 * assistive technology, so a result drawn there would be the answer to what the operator just did, out of reach.
 *
 * **The form is keyed by the revision it was opened on**, so a save, or a colleague's save the api refused this
 * one over, remounts it with the values now in force rather than leaving an edited copy of values that are stale.
 */
export function ProviderRecord({
  provider,
  pending,
  notice,
  onAction,
  onClose,
}: {
  readonly provider: IdentityProvider;
  readonly pending: ProviderAction | null;
  readonly notice: ReactNode;
  readonly onAction: (action: ProviderAction) => void;
  readonly onClose: () => void;
}) {
  const t = useTranslations('platform.identityProviders.record');
  const tProviders = useTranslations('platform.identityProviders.providers');
  const tChrome = useTranslations('chrome.dialog');

  return (
    <Dialog
      open
      onClose={onClose}
      title={tProviders(provider.provider)}
      closeLabel={tChrome('close')}
      footer={
        <Button type="button" variant={BUTTON_VARIANT.SECONDARY} onClick={onClose}>
          {t('close')}
        </Button>
      }
    >
      {notice}
      <ProviderFacts provider={provider} />
      <ProviderStateControl provider={provider} pending={pending} onAction={onAction} />
      <ProviderSecret provider={provider} />
      <ProviderSettingsForm
        key={`${provider.provider}:${String(provider.revision)}`}
        provider={provider}
        pending={pending}
        onAction={onAction}
      />
    </Dialog>
  );
}
