import { BUTTON_VARIANT, Button, CALLOUT_INTENT, Callout } from '@easyesg/ui';
import { useTranslations } from 'use-intl';

/**
 * A-07's *error — recoverable* for a region (task 67.9), with a retry.
 *
 * **In `components/shared/` on its readers**: the in-progress and log sections, and the grant region's shared failure.
 */
export function SupportAccessUnavailable({ onRetry }: { readonly onRetry: () => void }) {
  const t = useTranslations('platform.supportAccess.unavailable');

  return (
    <Callout
      intent={CALLOUT_INTENT.ERROR}
      title={t('title')}
      action={
        <Button type="button" variant={BUTTON_VARIANT.SECONDARY} onClick={onRetry}>
          {t('action')}
        </Button>
      }
    >
      {t('body')}
    </Callout>
  );
}
