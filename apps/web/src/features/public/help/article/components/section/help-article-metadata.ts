import { API_OUTCOME } from '@easyesg/contracts';
import type { Locale } from '@easyesg/i18n';
import { getTranslations } from 'next-intl/server';
import { readHelpArticle } from '@/server/data/help-content';
import { HELP_ARTICLE_MESSAGES } from '../shared/help-article-messages';

/**
 * S-33's title in the browser's tab (task 77) — the article's, read through the same `cache()`d read the page makes, so
 * the two are one request. An article that cannot be read takes the help centre's name.
 */
export async function generateHelpArticleMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; article: string }>;
}): Promise<{ title?: string }> {
  const { locale, article } = await params;
  const [t, read] = await Promise.all([
    getTranslations({ locale, namespace: HELP_ARTICLE_MESSAGES }),
    readHelpArticle(article, locale),
  ]);
  return read.status === API_OUTCOME.Ok ? { title: t('metaTitle', { title: read.value.title }) } : {};
}
