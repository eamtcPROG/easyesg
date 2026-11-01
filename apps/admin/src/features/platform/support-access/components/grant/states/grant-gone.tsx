import { BUTTON_VARIANT, Button, CALLOUT_INTENT, Callout } from '@easyesg/ui';
import { useTranslations } from 'use-intl';

/**
 * An address naming a grant this operator cannot read (task 67.9) — not among what is in progress, or another
 * operator's. A grant is given to the person who asked, so there is nothing to open, and the log says what became
 * of the request.
 */
export function GrantGone({ onClose }: { readonly onClose: () => void }) {
  const t = useTranslations('platform.supportAccess.grant');

  return (
    <Callout
      intent={CALLOUT_INTENT.ATTENTION}
      title={t('goneTitle')}
      action={
        <Button type="button" variant={BUTTON_VARIANT.SECONDARY} onClick={onClose}>
          {t('close')}
        </Button>
      }
    >
      {t('goneBody')}
    </Callout>
  );
}
