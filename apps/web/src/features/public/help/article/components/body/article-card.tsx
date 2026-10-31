import type { HelpArticle } from '@easyesg/contracts';
import { getTranslations } from 'next-intl/server';
import { SHORT_ANSWER_ID, sectionId } from '../shared/article-anchors';
import { HELP_ARTICLE_MESSAGES } from '../shared/help-article-messages';
import { ArticleSection } from './article-section';
import styles from './body.module.css';

/**
 * S-33's article as artboard 03 draws it (tasks 77, 227) — a card at reading measure: the module it belongs to, its
 * title, then **the summary as the short answer, above the explanation** (`architecture.md` §12.5.6's task-227 row
 * (6)), then its sections. **An article served in Romanian on another language's page is marked as Romanian, and
 * nothing else** (UX-97; WCAG 2.2 3.1.2): each of its own parts carries the language, and the page's words — *the short
 * answer*, *Show* — keep the page's.
 */
export async function ArticleCard({ article, lang }: { readonly article: HelpArticle; readonly lang: string | undefined }) {
  const t = await getTranslations(HELP_ARTICLE_MESSAGES);

  return (
    <article aria-labelledby="article-title" className={styles.card}>
      <header className={styles.head}>
        <p className={styles.eyebrow} lang={lang}>
          {article.module}
        </p>
        <h1 id="article-title" className={`t-heading-1 ${styles.title}`} lang={lang}>
          {article.title}
        </h1>
      </header>
      {/* A heading, not a landmark: a region named *the short answer* would share its name with any section an editor
          heads the same way — the starter library's *In short* is *Коротко*, which this word once was in Russian. */}
      <div id={SHORT_ANSWER_ID} className={styles.shortAnswer}>
        <h2 className={styles.shortAnswerLabel}>{t('shortAnswer')}</h2>
        <p className={styles.shortAnswerText} lang={lang}>
          {article.summary}
        </p>
      </div>
      {article.sections.map((section, index) => (
        <ArticleSection key={sectionId(index)} id={sectionId(index)} section={section} lang={lang} show={t('show')} />
      ))}
    </article>
  );
}
