import { BUTTON_VARIANT, Button } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import pageStyles from '../../../shared/help-page.module.css';
import { HELP_ARTICLE_MESSAGES } from '../shared/help-article-messages';

/**
 * S-33's way to a person (tasks 77, 227; artboard 03's *Still not sure about your lease?*) — advice rather than an
 * action, on the page's own ground, at the right-hand column's foot. The artboard's title names its one article; this
 * one is every article's.
 */
export async function StillNotSure() {
  const t = await getTranslations(HELP_ARTICLE_MESSAGES);

  return (
    <section aria-labelledby="article-still" className={`${pageStyles.card} ${pageStyles.quiet}`}>
      <div className={pageStyles.cardOnly}>
        <h2 id="article-still" className="t-label">
          {t('still.title')}
        </h2>
        <p className={`t-caption ${pageStyles.body}`}>{t('still.body')}</p>
        <div>
          <Button asChild variant={BUTTON_VARIANT.SECONDARY}>
            <Link href={ROUTES.HELP_CONTACT}>{t('still.action')}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
