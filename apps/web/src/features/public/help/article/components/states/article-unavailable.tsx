import { CALLOUT_INTENT, Callout, MAIN_CONTENT_ID, TextLink } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import pageStyles from '../../../shared/help-page.module.css';
import { HELP_ARTICLE_MESSAGES } from '../shared/help-article-messages';

/**
 * S-33's `error — system` (§8.1): the article could not be read — distinct from *not found*, which an article not in
 * force answers and the address-not-found pattern draws. The way on is back to the library. **It draws the screen's one
 * landmark** on the help's ground (task 227), since the section never reached its own.
 */
export async function ArticleUnavailable() {
  const t = await getTranslations(HELP_ARTICLE_MESSAGES);
  return (
    <main id={MAIN_CONTENT_ID} tabIndex={-1} className={pageStyles.page}>
      <div className={`${pageStyles.columns} ${pageStyles.inner}`}>
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
      </div>
    </main>
  );
}
