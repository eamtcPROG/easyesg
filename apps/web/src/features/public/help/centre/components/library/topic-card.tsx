import type { HelpArticleSummary } from '@easyesg/contracts';
import type { Locale } from '@easyesg/i18n';
import { TextLink } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import { languageOf } from '../../../shared/help-language';
import type { TopicCard as TopicCardData } from '../../tools/help-library';
import { HELP_CENTRE_MESSAGES } from '../shared/help-centre-messages';
import styles from './library.module.css';

/**
 * One topic's card (task 227; artboards 01 and 02): its title, which narrows the library to it (UX-4), its summary, the
 * articles it names first — artboard 01's two links, none on the visitor's artboard 02 — and how many it holds. A topic
 * fallen back to Romanian carries its language, as each article does (UX-97; WCAG 2.2 3.1.2). The articles naming no
 * topic in force have a card with no link to narrow by.
 */
export async function TopicCard({
  card,
  featured,
  page,
  query,
}: {
  readonly card: TopicCardData;
  /** The articles to name on the card — the card's own first, or none. */
  readonly featured: readonly HelpArticleSummary[];
  readonly page: Locale;
  /** What every link carries — the help's language, where one is chosen. */
  readonly query: Readonly<Record<string, string>>;
}) {
  const t = await getTranslations(HELP_CENTRE_MESSAGES);
  const { topic, articles } = card.group;

  return (
    <article className={styles.card} lang={topic === null ? undefined : languageOf({ written: topic.locale, page })}>
      <h3 className={`t-heading-3 ${styles.cardTitle}`}>
        {topic === null ? (
          t('other')
        ) : (
          <Link className={styles.cardLink} href={{ pathname: ROUTES.HELP_CENTRE, query: { ...query, topic: topic.key } }}>
            {topic.title}
          </Link>
        )}
      </h3>
      {topic === null ? null : <p className={`t-caption ${styles.cardSummary}`}>{topic.summary}</p>}
      <div className={styles.cardFoot}>
        {featured.length === 0 ? null : (
          <ul className={styles.featured}>
            {featured.map((article) => (
              <li key={article.key} lang={languageOf({ written: article.locale, page })}>
                <TextLink asChild>
                  <Link href={{ pathname: `${ROUTES.HELP_CENTRE}/${encodeURIComponent(article.key)}`, query }}>
                    {article.title}
                  </Link>
                </TextLink>
              </li>
            ))}
          </ul>
        )}
        <p className={styles.count}>{t('count', { count: articles.length })}</p>
      </div>
    </article>
  );
}
