import { BUTTON_VARIANT, Button, CALLOUT_INTENT, Callout } from '@easyesg/ui';
import { useTranslations } from 'use-intl';

/** A-21's *error — recoverable* (task 75), with a retry. */
export function LegalControllerUnavailable({ onRetry }: { readonly onRetry: () => void }) {
  const t = useTranslations('platform.legalController.unavailable');

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
