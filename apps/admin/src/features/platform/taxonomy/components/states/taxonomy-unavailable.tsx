import { BUTTON_VARIANT, Button, CALLOUT_INTENT, Callout } from '@easyesg/ui';
import { useTranslations } from 'use-intl';

/** A-04's error — recoverable (§8.1): a read with no answer, and the retry that is its remedy. */
export function TaxonomyUnavailable({ onRetry }: { readonly onRetry: () => void }) {
  const t = useTranslations('platform.taxonomy.unavailable');
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
