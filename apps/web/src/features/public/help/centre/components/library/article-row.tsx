import type { HelpArticleSummary } from '@easyesg/contracts';
import type { Locale } from '@easyesg/i18n';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import { languageOf } from '../../../shared/help-language';
import pageStyles from '../../../shared/help-page.module.css';

/**
 * One article as a row of S-32's results (tasks 77, 227): its title as the link that opens it, its summary, and the
 * module it belongs to (S-32: *every article names the module it belongs to*). Read in Romanian on another language's
 * page, it carries that language (UX-97; WCAG 2.2 3.1.2).
 */
export function ArticleRow({
  article,
  page,
  query,
}: {
  readonly article: HelpArticleSummary;
  readonly page: Locale;
  readonly query: Readonly<Record<string, string>>;
}) {
  return (
    <Link
      className={pageStyles.rowLink}
      href={{ pathname: `${ROUTES.HELP_CENTRE}/${encodeURIComponent(article.key)}`, query }}
      lang={languageOf({ written: article.locale, page })}
    >
      <span className={`t-body ${pageStyles.rowTitle}`}>{article.title}</span>
      <span className={`t-caption ${pageStyles.body}`}>{article.summary}</span>
      <span className={`t-caption ${pageStyles.muted}`}>{article.module}</span>
    </Link>
  );
}
