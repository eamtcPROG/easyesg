import { Callout, CALLOUT_INTENT, TextLink } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import { CENTRE_MESSAGES } from '../shared/centre-messages';

/**
 * S-26's *error — permission* (task 50.2.1): every member reads a centre, so a refusal means the session acts for no
 * organization it belongs to. The section has already sent a reader with a choice to make to S-37; this is what is
 * left, and its one way on is home.
 */
export async function CentreRefused() {
  const t = await getTranslations(`${CENTRE_MESSAGES}.error.permission`);
  return (
    <Callout
      intent={CALLOUT_INTENT.WARNING}
      title={t('title')}
      action={
        <TextLink asChild>
          <Link href={ROUTES.HOME}>{t('action')}</Link>
        </TextLink>
      }
    >
      {t('body')}
    </Callout>
  );
}
