import { BUTTON_VARIANT, Button, CALLOUT_INTENT, Callout } from '@easyesg/ui';
import { useTranslations } from 'use-intl';

/**
 * A grant that is no longer running (task 67.9) — its 60 minutes ran out, or someone ended it. **Not an error**: the
 * access worked as designed, and the next step is a new request with its own reason, which the body says.
 */
export function GrantEnded({ onClose }: { readonly onClose: () => void }) {
  const t = useTranslations('platform.supportAccess.grant');

  return (
    <Callout
      intent={CALLOUT_INTENT.INFO}
      title={t('endedTitle')}
      action={
        <Button type="button" variant={BUTTON_VARIANT.SECONDARY} onClick={onClose}>
          {t('close')}
        </Button>
      }
    >
      {t('endedBody')}
    </Callout>
  );
}
