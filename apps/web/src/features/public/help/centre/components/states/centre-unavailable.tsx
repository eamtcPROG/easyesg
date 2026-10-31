import { CALLOUT_INTENT, Callout, TextLink } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import { HELP_CENTRE_MESSAGES } from '../shared/help-centre-messages';

/**
 * S-32's `error — system` (§8.1): the library could not be read. The heading stays above it, and the way on is the
 * person who can still answer — support's form reads nothing of the library.
 */
export async function CentreUnavailable() {
  const t = await getTranslations(HELP_CENTRE_MESSAGES);
  return (
    <Callout
      intent={CALLOUT_INTENT.ERROR}
      title={t('unavailable.title')}
      action={
        <TextLink asChild>
          <Link href={ROUTES.HELP_CONTACT}>{t('support.action')}</Link>
        </TextLink>
      }
    >
      {t('unavailable.body')}
    </Callout>
  );
}
