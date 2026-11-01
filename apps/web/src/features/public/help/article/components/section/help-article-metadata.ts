import { API_OUTCOME } from '@easyesg/contracts';
import type { Locale } from '@easyesg/i18n';
import { getTranslations } from 'next-intl/server';
import { readHelpArticle } from '@/server/data/help-content';
import { helpLanguageOf } from '../../../shared/help-language';
import { HELP_ARTICLE_MESSAGES } from '../shared/help-article-messages';

/**
 * S-33's title in the browser's tab (tasks 77, 227) — the article's, in the help's language the address chose, read
 * through the same `cache()`d read the page makes, so the two are one request. An article that cannot be read takes the
 * help centre's name.
 */
export async function generateHelpArticleMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale; article: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<{ title?: string }> {
  const [{ locale, article }, { content }] = await Promise.all([params, searchParams]);
  const [t, read] = await Promise.all([
    getTranslations({ locale, namespace: HELP_ARTICLE_MESSAGES }),
    readHelpArticle(article, helpLanguageOf({ requested: typeof content === 'string' ? content : undefined, page: locale })),
  ]);
  return read.status === API_OUTCOME.Ok ? { title: t('metaTitle', { title: read.value.title }) } : {};
}
