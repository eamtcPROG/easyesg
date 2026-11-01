import type { HelpArticleSummary } from '@easyesg/contracts';
import type { Locale } from '@easyesg/i18n';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import { languageOf } from '../../../shared/help-language';
import pageStyles from '../../../shared/help-page.module.css';
import { HELP_CENTRE_MESSAGES } from '../shared/help-centre-messages';
import styles from './asked.module.css';

/**
 * A visitor's *Asked before signing up* (task 227; artboard 02; `architecture.md` §12.5.6's task-227 row (3)) — the
 * first-report topic's articles, each title the question and its summary the answer, the question opening the article.
 * Store content, so an editor changes it without a release; the artboard's four answers stated facts no document
 * confirms, and none of them is written here.
 */
export async function AskedBeforeSigningUp({
  articles,
  page,
  query,
}: {
  readonly articles: readonly HelpArticleSummary[];
  readonly page: Locale;
  readonly query: Readonly<Record<string, string>>;
}) {
  const t = await getTranslations(HELP_CENTRE_MESSAGES);

  return (
    <section aria-labelledby="help-asked" className={pageStyles.region}>
      <div className={pageStyles.regionHead}>
        <h2 id="help-asked" className={pageStyles.regionTitle}>
          {t('guest.asked.title')}
        </h2>
        <p className={`t-caption ${pageStyles.muted}`}>{t('guest.asked.aside')}</p>
      </div>
      <ul className={`${pageStyles.card} ${pageStyles.rows}`}>
        {articles.map((article) => (
          <li key={article.key} className={styles.answer} lang={languageOf({ written: article.locale, page })}>
            <h3 className={`t-heading-3 ${styles.question}`}>
              <Link
                className={styles.questionLink}
                href={{ pathname: `${ROUTES.HELP_CENTRE}/${encodeURIComponent(article.key)}`, query }}
              >
                {article.title}
              </Link>
            </h3>
            <p className={`t-body ${pageStyles.body}`}>{article.summary}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
