import type { HelpTopic } from '@easyesg/contracts';
import type { Locale } from '@easyesg/i18n';
import { getTranslations } from 'next-intl/server';
import { ROUTES } from '@/lib/routes';
import { HelpLanguageChoice } from '../../../shared/help-language-choice';
import { HelpTrail } from '../../../shared/help-trail';
import { HELP_ARTICLE_MESSAGES } from '../shared/help-article-messages';

/** A query string for a trail step's address, which the Breadcrumb takes as one string. */
const withQuery = (path: string, query: Readonly<Record<string, string>>): string => {
  const search = new URLSearchParams(query).toString();
  return search === '' ? path : `${path}?${search}`;
};

/**
 * S-33's bar beneath the chrome (task 227; artboard 03) — the trail *Help centre / <topic> / <article>*, each step
 * keeping the help's language, and the help's language at the end (`architecture.md` §12.5.6's task-227 row (2)). The
 * topic is named where it is in force; an article naming none has the help centre alone above it.
 */
export async function ArticleBar({
  articleKey,
  title,
  topic,
  content,
  query,
}: {
  readonly articleKey: string;
  /** The article's title, already marked in its language where it differs from the page's. */
  readonly title: React.ReactNode;
  readonly topic: HelpTopic | null;
  readonly content: Locale;
  /** What every link carries — the help's language, where one is chosen. */
  readonly query: Readonly<Record<string, string>>;
}) {
  const t = await getTranslations(HELP_ARTICLE_MESSAGES);

  return (
    <HelpTrail
      trail={[
        { href: withQuery(ROUTES.HELP_CENTRE, query), label: t('breadcrumb') },
        ...(topic === null ? [] : [{ href: withQuery(ROUTES.HELP_CENTRE, { ...query, topic: topic.key }), label: topic.title }]),
      ]}
      current={title}
    >
      <HelpLanguageChoice
        content={content}
        pathname={`${ROUTES.HELP_CENTRE}/${encodeURIComponent(articleKey)}`}
        query={{}}
      />
    </HelpTrail>
  );
}
