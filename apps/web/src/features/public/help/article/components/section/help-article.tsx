import { API_OUTCOME } from '@easyesg/contracts';
import type { Locale } from '@easyesg/i18n';
import { MAIN_CONTENT_ID } from '@easyesg/ui';
import { notFound } from 'next/navigation';
import { readHelpArticle, readHelpTopics } from '@/server/data/help-content';
import { HelpAccountCard } from '../../../shared/help-account-card';
import { helpLanguageOf, helpLanguageQuery, languageOf } from '../../../shared/help-language';
import pageStyles from '../../../shared/help-page.module.css';
import { ArticleBar } from '../bar/article-bar';
import { ArticleCard } from '../body/article-card';
import { ArticleReadNext } from '../rail/article-read-next';
import { StillNotSure } from '../rail/still-not-sure';
import { sectionId } from '../shared/article-anchors';
import { ArticleAppliesTo } from '../side/article-applies-to';
import { ArticleContents } from '../side/article-contents';
import { ArticleUnavailable } from '../states/article-unavailable';
import styles from './help-article.module.css';

/**
 * S-33 — UC-181 (tasks 77, 227; FR-61, FR-64; `design_spec.md` S-33, as `EasyESG Help Centre.dc.html`'s artboard 03
 * draws it — `architecture.md` §12.5.6's task-227 row (1)). **The section reads; the parts render**: the article in the
 * help's language (row (2)), and the topics, to name its topic in the trail. **An article not in force has no address**
 * (task 76's row (1)): its 404 is `notFound()`, which the locale's not-found boundary draws as §8.1's *not found*; a
 * read that failed is the `error — system` state instead. A failed topics read only leaves the topic out of the trail.
 *
 * Three columns at the widest frame: the contents and *Applies to*, the article, and the right-hand column — the
 * account card for a visitor (artboard 03's note), *Read next*, and the way to a person. **It reads no session**: the
 * route says whether the reader is signed in.
 */
export async function HelpArticle({
  articleKey,
  page,
  requestedContent,
  signedIn,
}: {
  readonly articleKey: string;
  /** The page's language — the interface's. */
  readonly page: Locale;
  /** The help's language the address names, as given. */
  readonly requestedContent: string | undefined;
  readonly signedIn: boolean;
}) {
  const content = helpLanguageOf({ requested: requestedContent, page });
  const [read, topics] = await Promise.all([readHelpArticle(articleKey, content), readHelpTopics(content)]);
  if (read.status === API_OUTCOME.Problem && read.problem.status === 404) notFound();
  if (read.status !== API_OUTCOME.Ok) return <ArticleUnavailable />;

  const article = read.value;
  const lang = languageOf({ written: article.locale, page });
  const query = helpLanguageQuery({ content, page });
  const topic =
    topics.status === API_OUTCOME.Ok ? (topics.value.items.find((entry) => entry.key === article.topic) ?? null) : null;

  return (
    <>
      <ArticleBar
        articleKey={article.key}
        title={lang === undefined ? article.title : <span lang={lang}>{article.title}</span>}
        topic={topic}
        content={content}
        query={query}
      />
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className={pageStyles.page}>
        <div className={styles.columns}>
          <div className={styles.side}>
            <ArticleContents
              sections={article.sections.map((section, index) => ({ id: sectionId(index), label: section.heading }))}
              lang={lang}
            />
            <ArticleAppliesTo module={article.module} lang={lang} />
          </div>
          <ArticleCard article={article} lang={lang} />
          <div className={pageStyles.rail}>
            {signedIn ? null : <HelpAccountCard />}
            <ArticleReadNext related={article.related} page={page} query={query} />
            <StillNotSure />
          </div>
        </div>
      </main>
    </>
  );
}
