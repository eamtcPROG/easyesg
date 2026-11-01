import type { HelpArticleSummary, HelpTopic } from '@easyesg/contracts';
import type { Locale } from '@easyesg/i18n';
import { TextLink } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import { languageOf } from '../../../shared/help-language';
import pageStyles from '../../../shared/help-page.module.css';
import { HELP_CENTRE_MESSAGES } from '../shared/help-centre-messages';
import { ArticleRow } from './article-row';

/**
 * What a topic or a search keeps (tasks 77, 227) — named by the topic, or by how many articles the words found, with
 * the way back to the whole library beside it, then the articles as rows. **The artboards draw no results**; this is
 * *Asked most this month*'s anatomy (artboard 01) given to them, so a narrowed library reads as the same page.
 */
export async function LibraryResults({
  articles,
  topic,
  words,
  page,
  query,
}: {
  readonly articles: readonly HelpArticleSummary[];
  /** The topic narrowed to, or `null` where only words narrow. */
  readonly topic: HelpTopic | null;
  /** The words searched for, `''` for none. */
  readonly words: string;
  readonly page: Locale;
  /** What every link carries — the help's language, where one is chosen. */
  readonly query: Readonly<Record<string, string>>;
}) {
  const t = await getTranslations(HELP_CENTRE_MESSAGES);

  return (
    <section aria-labelledby="help-results" className={pageStyles.region}>
      <div className={pageStyles.regionHead}>
        <h2
          id="help-results"
          className={pageStyles.regionTitle}
          lang={topic === null || words !== '' ? undefined : languageOf({ written: topic.locale, page })}
        >
          {topic === null || words !== '' ? t('results.words', { count: articles.length, query: words }) : topic.title}
        </h2>
        <TextLink asChild>
          <Link href={{ pathname: ROUTES.HELP_CENTRE, query }}>{t('results.all')}</Link>
        </TextLink>
      </div>
      <ul className={`${pageStyles.card} ${pageStyles.rows}`}>
        {articles.map((article) => (
          <li key={article.key}>
            <ArticleRow article={article} page={page} query={query} />
          </li>
        ))}
      </ul>
    </section>
  );
}
