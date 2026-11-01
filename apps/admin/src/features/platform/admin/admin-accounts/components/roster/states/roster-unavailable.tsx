import { BUTTON_VARIANT, Button, CALLOUT_INTENT, Callout } from '@easyesg/ui';
import { useTranslations } from 'use-intl';

/** A-08's *error — recoverable* for the account region (task 67.4), with a retry. */
export function RosterUnavailable({ onRetry }: { readonly onRetry: () => void }) {
  const t = useTranslations('platform.accounts.unavailable');

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
