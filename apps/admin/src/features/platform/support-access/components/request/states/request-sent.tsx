import { BUTTON_VARIANT, Button, CALLOUT_INTENT, Callout } from '@easyesg/ui';
import { useTranslations } from 'use-intl';

/**
 * A request just sent (task 67.9) — A-07's *success* for the Focus half: that it went, and that nothing is readable
 * until the organization's administrator accepts it.
 */
export function RequestSent({
  organization,
  onDismiss,
}: {
  readonly organization: string;
  readonly onDismiss: () => void;
}) {
  const t = useTranslations('platform.supportAccess.request');

  return (
    <Callout
      intent={CALLOUT_INTENT.SUCCESS}
      title={t('sentTitle')}
      action={
        <Button type="button" variant={BUTTON_VARIANT.SUBTLE} onClick={onDismiss}>
          {t('dismiss')}
        </Button>
      }
    >
      {t('sentBody', { organization })}
    </Callout>
  );
}
