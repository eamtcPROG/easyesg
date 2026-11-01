import { BUTTON_VARIANT, Button, CALLOUT_INTENT, Callout } from '@easyesg/ui';
import { useTranslations } from 'use-intl';

/**
 * A-19's *partial* state (task 151): the recovery-code read has no usable answer, while the password
 * and the second factor above stay usable — the body says so — with a retry for this region alone.
 */
export function RecoveryCodesUnavailable({ onRetry }: { readonly onRetry: () => void }) {
  const t = useTranslations('realm.credentials.recoveryCodes.unavailable');

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
