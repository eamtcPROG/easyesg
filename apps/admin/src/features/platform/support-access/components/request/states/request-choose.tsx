import { CALLOUT_INTENT, Callout, TextLink } from '@easyesg/ui';
import { Link } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';

/**
 * The request region with no organization chosen (task 67.9) — A-07's *empty* for the Focus half. **A request
 * starts from an organization's record in the register**, so it is plain whom access is being asked of; this says
 * so and goes there.
 */
export function RequestChoose() {
  const t = useTranslations('platform.supportAccess.request');

  return (
    <Callout
      intent={CALLOUT_INTENT.INFO}
      title={t('chooseTitle')}
      action={
        <TextLink asChild>
          <Link to="/organizations">{t('chooseAction')}</Link>
        </TextLink>
      }
    >
      {t('chooseBody')}
    </Callout>
  );
}
