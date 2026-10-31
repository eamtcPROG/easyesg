import type { Locale } from '@easyesg/i18n';
import { getTranslations } from 'next-intl/server';
import type { LibraryGroup } from '../../tools/help-library';
import { HELP_CENTRE_MESSAGES } from '../shared/help-centre-messages';
import styles from '../shared/help-centre.module.css';
import { HelpArticleCard } from './help-article-card';

/**
 * S-32's library as narrowed (task 77; UC-180) — one region per topic, in the topics' order, named by the topic's title
 * and its summary, then the articles that match. **A topic in another language than the page is marked as such** — the
 * fallback's `lang`, not a marker (UX-97; WCAG 2.2 3.1.2).
 */
export async function HelpLibrary({
  groups,
  locale,
}: {
  readonly groups: readonly LibraryGroup[];
  readonly locale: Locale;
}) {
  const t = await getTranslations(HELP_CENTRE_MESSAGES);

  return (
    <>
      {groups.map((group) => {
        const id = `topic-${group.topic?.key ?? 'other'}`;
        return (
          <section
            key={id}
            aria-labelledby={id}
            className={styles.group}
            lang={group.topic !== null && group.topic.locale !== locale ? group.topic.locale : undefined}
          >
            <h2 id={id} className="t-heading-2">
              {group.topic?.title ?? t('other')}
            </h2>
            {group.topic === null ? null : <p className={`t-body ${styles.groupSummary}`}>{group.topic.summary}</p>}
            <p className="t-caption">{t('count', { count: group.articles.length })}</p>
            <ul className={styles.articles}>
              {group.articles.map((article) => (
                <li key={article.key}>
                  <HelpArticleCard article={article} locale={locale} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}
