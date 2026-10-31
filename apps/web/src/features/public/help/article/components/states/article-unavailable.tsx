import { CALLOUT_INTENT, Callout, FOCUS_MEASURE, FocusColumn, TextLink } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import { HELP_ARTICLE_MESSAGES } from '../shared/help-article-messages';

/**
 * S-33's `error — system` (§8.1): the article could not be read — distinct from *not found*, which an article not in
 * force answers and the address-not-found pattern draws. The way on is back to the library.
 */
export async function ArticleUnavailable() {
  const t = await getTranslations(HELP_ARTICLE_MESSAGES);
  return (
    <FocusColumn measure={FOCUS_MEASURE.WIDE}>
      <Callout
        intent={CALLOUT_INTENT.ERROR}
        title={t('unavailable.title')}
        action={
          <TextLink asChild>
            <Link href={ROUTES.HELP_CENTRE}>{t('back')}</Link>
          </TextLink>
        }
      >
        {t('unavailable.body')}
      </Callout>
    </FocusColumn>
  );
}
