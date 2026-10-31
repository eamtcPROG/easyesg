import { API_OUTCOME } from '@easyesg/contracts';
import type { Locale } from '@easyesg/i18n';
import { BUTTON_VARIANT, Button, ContentContents, ContentSection, ContentShell, TextLink } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import { readHelpArticle } from '@/server/data/help-content';
import { ArticleBody } from '../body/article-body';
import { ArticleReadNext, READ_NEXT_ID } from '../next/article-read-next';
import { HELP_ARTICLE_MESSAGES } from '../shared/help-article-messages';
import styles from '../shared/help-article.module.css';
import { ArticleUnavailable } from '../states/article-unavailable';

/** A section's anchor, by its place — the headings an editor writes are prose, not ids. */
const sectionId = (index: number): string => `section-${index + 1}`;

/**
 * S-33 — UC-181 (task 77.3; FR-61, FR-64; `design_spec.md` S-33, Content archetype). **The section reads; the parts
 * render**: one read of the article in the page's language. **An article not in force has no address** (task 76's row
 * (1)): its 404 is `notFound()`, which the locale's not-found boundary draws as §8.1's *not found*; a read that failed is
 * the `error — system` state instead.
 *
 * **An article served in Romanian on another language's page is marked as Romanian, and nothing else** (UX-97; WCAG 2.2
 * 3.1.2): each of its own parts — module, title, summary, each section — carries the language, and the page's words
 * around them keep the page's. Its module is named above the title (S-33), *On this page* lists its sections, and a
 * disclosed section is one the reader opens (UX-17).
 */
export async function HelpArticle({ articleKey, locale }: { readonly articleKey: string; readonly locale: Locale }) {
  const [t, read] = await Promise.all([getTranslations(HELP_ARTICLE_MESSAGES), readHelpArticle(articleKey, locale)]);
  if (read.status === API_OUTCOME.Problem && read.problem.status === 404) notFound();
  if (read.status !== API_OUTCOME.Ok) return <ArticleUnavailable />;
  const article = read.value;
  // The article's own language where it fell back; `undefined` leaves the page's.
  const lang = article.locale === locale ? undefined : article.locale;
  const part = (words: string) => (lang === undefined ? words : <span lang={lang}>{words}</span>);

  return (
    <ContentShell
        eyebrow={part(article.module)}
        title={part(article.title)}
        lede={part(article.summary)}
        contents={
          <ContentContents
            label={t('contents')}
            sections={[
              ...article.sections.map((section, index) => ({ id: sectionId(index), label: section.heading })),
              ...(article.related.length === 0 ? [] : [{ id: READ_NEXT_ID, label: t('readNext') }]),
            ]}
          />
        }
      >
        {article.sections.map((section, index) => (
          <ContentSection key={sectionId(index)} id={sectionId(index)} heading={part(section.heading)}>
            {section.disclosed ? (
              <details className={styles.disclosure}>
                <summary>{t('show')}</summary>
                <div lang={lang}>
                  <ArticleBody body={section.body} />
                </div>
              </details>
            ) : (
              <div lang={lang}>
                <ArticleBody body={section.body} />
              </div>
            )}
          </ContentSection>
        ))}
        <ArticleReadNext related={article.related} locale={locale} />
        <div className={styles.ways}>
          <p className="t-heading-3">{t('support.title')}</p>
          <p className="t-body">{t('support.body')}</p>
          <div>
            <Button asChild variant={BUTTON_VARIANT.SECONDARY}>
              <Link href={ROUTES.HELP_CONTACT}>{t('support.action')}</Link>
            </Button>
          </div>
          <TextLink asChild>
            <Link href={ROUTES.HELP_CENTRE}>{t('back')}</Link>
          </TextLink>
        </div>
    </ContentShell>
  );
}
