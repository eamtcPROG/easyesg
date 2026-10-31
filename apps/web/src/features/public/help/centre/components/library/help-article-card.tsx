import type { HelpArticleSummary } from '@easyesg/contracts';
import type { Locale } from '@easyesg/i18n';
import { TextLink } from '@easyesg/ui';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import styles from '../shared/help-centre.module.css';

/**
 * One article of S-32's library (task 77) — the module it belongs to first (S-32: *every article names the module it
 * belongs to*), its title as the link that opens it, and its summary. An article served in Romanian on another
 * language's page carries that language, so a screen reader reads it as written (UX-97; WCAG 2.2 3.1.2).
 */
export function HelpArticleCard({
  article,
  locale,
}: {
  readonly article: HelpArticleSummary;
  readonly locale: Locale;
}) {
  return (
    <article className={styles.card} lang={article.locale === locale ? undefined : article.locale}>
      <p className={`t-caption ${styles.cardModule}`}>{article.module}</p>
      <h3 className="t-heading-3">
        <TextLink asChild>
          <Link href={`${ROUTES.HELP_CENTRE}/${encodeURIComponent(article.key)}`}>{article.title}</Link>
        </TextLink>
      </h3>
      <p className="t-body">{article.summary}</p>
    </article>
  );
}
