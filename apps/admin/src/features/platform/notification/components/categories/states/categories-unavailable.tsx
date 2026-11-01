import { BUTTON_VARIANT, Button, CALLOUT_INTENT, Callout } from '@easyesg/ui';
import { useTranslations } from 'use-intl';

/** A-17's *error — recoverable* (task 67.10), with a retry. */
export function CategoriesUnavailable({ onRetry }: { readonly onRetry: () => void }) {
  const t = useTranslations('platform.notificationCategories.unavailable');

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
