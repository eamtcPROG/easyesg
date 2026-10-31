import type { HelpArticleLink } from '@easyesg/contracts';
import type { Locale } from '@easyesg/i18n';
import { ContentSection, TextLink } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import { HELP_ARTICLE_MESSAGES } from '../shared/help-article-messages';
import styles from '../shared/help-article.module.css';

/** The id S-33's *read next* region answers to in *On this page*. */
export const READ_NEXT_ID = 'read-next';

/**
 * S-33's *read next* (task 77; `design_spec.md` §5's S-33 row) — the articles the article names that are in force, each
 * in its own language where it fell back. Absent where it names none.
 */
export async function ArticleReadNext({
  related,
  locale,
}: {
  readonly related: readonly HelpArticleLink[];
  readonly locale: Locale;
}) {
  if (related.length === 0) return null;
  const t = await getTranslations(HELP_ARTICLE_MESSAGES);
  return (
    <ContentSection id={READ_NEXT_ID} heading={t('readNext')}>
      <ul className={styles.next}>
        {related.map((link) => (
          <li key={link.key} lang={link.locale === locale ? undefined : link.locale}>
            <TextLink asChild>
              <Link href={`${ROUTES.HELP_CENTRE}/${encodeURIComponent(link.key)}`}>{link.title}</Link>
            </TextLink>
          </li>
        ))}
      </ul>
    </ContentSection>
  );
}
