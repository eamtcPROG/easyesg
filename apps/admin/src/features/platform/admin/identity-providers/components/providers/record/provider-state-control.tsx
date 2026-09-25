import type { IdentityProvider } from '@easyesg/contracts';
import { BUTTON_VARIANT, Button } from '@easyesg/ui';
import { useId } from 'react';
import { useTranslations } from 'use-intl';
import { isPendingControl, stateControlOf, type ProviderAction } from '../../../tools/provider-action-state';

/**
 * A-18's enable or disable (task 67.11). **The api's reason a provider could not sign anyone in is shown before the
 * click** (`enablementBlocker`, derived by the same rule that refuses an enablement): on a disabled provider it is
 * why *Enable* is unavailable, and on an enabled one it says the provider is enabled on paper and missing from
 * S-01. A write in flight disables the control, so a second click cannot race the first.
 *
 * **Which write it offers, and whether it is blocked, is `stateControlOf`'s** — the row's menu asks the same function
 * since task 170, so the record and the row cannot disagree about a provider.
 */
export function ProviderStateControl({
  provider,
  pending,
  onAction,
}: {
  readonly provider: IdentityProvider;
  readonly pending: ProviderAction | null;
  readonly onAction: (action: ProviderAction) => void;
}) {
  const t = useTranslations('platform.identityProviders');
  const reasonId = useId();
  const blocker = provider.enablementBlocker;
  const { action, blocked } = stateControlOf(provider);

  return (
    <div className="flex flex-col gap-[var(--space-2)]">
      {blocker === null ? null : (
        <p id={reasonId} className="t-caption text-[var(--text-body)]">
          {provider.enabled ? t('blockerWhileEnabled', { reason: t(`blocker.${blocker}`) }) : t(`blocker.${blocker}`)}
        </p>
      )}
      <div>
        <Button
          type="button"
          variant={BUTTON_VARIANT.SECONDARY}
          busy={isPendingControl({ pending, provider: provider.provider, control: action.control })}
          disabled={pending !== null || blocked}
          aria-describedby={blocker === null ? undefined : reasonId}
          onClick={() => onAction(action)}
        >
          {t(`controls.${action.control}`)}
        </Button>
      </div>
    </div>
  );
}
