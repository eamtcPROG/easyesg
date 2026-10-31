import type { HelpArticleLink } from '@easyesg/contracts';
import type { Locale } from '@easyesg/i18n';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import { languageOf } from '../../../shared/help-language';
import pageStyles from '../../../shared/help-page.module.css';
import { HELP_ARTICLE_MESSAGES } from '../shared/help-article-messages';

/**
 * S-33's *Read next* (tasks 77, 227; artboard 03) — the articles this one names that are in force, as rows in a card of
 * the right-hand column, each in its own language where it fell back and keeping the help's. Absent where it names
 * none. Each row's module and reading time are task 229's.
 */
export async function ArticleReadNext({
  related,
  page,
  query,
}: {
  readonly related: readonly HelpArticleLink[];
  readonly page: Locale;
  readonly query: Readonly<Record<string, string>>;
}) {
  if (related.length === 0) return null;
  const t = await getTranslations(HELP_ARTICLE_MESSAGES);

  return (
    <section aria-labelledby="article-next" className={pageStyles.card}>
      <div className={pageStyles.cardHead}>
        <h2 id="article-next" className={pageStyles.eyebrow}>
          {t('readNext')}
        </h2>
      </div>
      <ul className={pageStyles.rows}>
        {related.map((link) => (
          <li key={link.key}>
            <Link
              className={pageStyles.rowLink}
              href={{ pathname: `${ROUTES.HELP_CENTRE}/${encodeURIComponent(link.key)}`, query }}
              lang={languageOf({ written: link.locale, page })}
            >
              <span className={`t-body ${pageStyles.rowTitle}`}>{link.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
