import { BUTTON_VARIANT, Button, CALLOUT_INTENT, Callout } from '@easyesg/ui';
import { useTranslations } from 'use-intl';
import { RefusalCallout } from '~/realm/components/shared/refusal-callout';
import { PROVIDER_NOTICE, type ProviderNotice as Notice } from '../../../tools/provider-action-state';

/**
 * A-18's *success* state, its *conflict* state and its refusals, announced above the providers (task 67.11). A done
 * notice can be dismissed; the conflict and a refusal stay until the next write, which is when they stop being true.
 * **The conflict is worded here, not by the api**, because what it must say is what the screen now shows: the
 * values in force, reloaded under the notice.
 */
export function ProviderNotice({
  notice,
  onDismiss,
}: {
  readonly notice: Notice | null;
  readonly onDismiss: () => void;
}) {
  const t = useTranslations('platform.identityProviders.notice');
  const tProviders = useTranslations('platform.identityProviders.providers');
  if (notice === null) return null;

  switch (notice.kind) {
    case PROVIDER_NOTICE.DONE:
      return (
        <Callout
          intent={CALLOUT_INTENT.SUCCESS}
          title={t('doneTitle')}
          action={
            <Button type="button" variant={BUTTON_VARIANT.SUBTLE} onClick={onDismiss}>
              {t('dismiss')}
            </Button>
          }
        >
          {t(`done.${notice.action.control}`, { provider: tProviders(notice.action.provider) })}
        </Callout>
      );
    case PROVIDER_NOTICE.CHANGED:
      return (
        <Callout intent={CALLOUT_INTENT.ATTENTION} title={t('changedTitle')} action={null}>
          {t('changedBody', { provider: tProviders(notice.provider) })}
        </Callout>
      );
    case PROVIDER_NOTICE.REFUSED:
      return <RefusalCallout failure={notice.failure} title={t('refusedTitle')} fallback={t('refusedBody')} />;
  }
}
