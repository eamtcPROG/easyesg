import { HelpArticle } from '@/features/public/help/article/components/section/help-article';
import { generateHelpArticleMetadata } from '@/features/public/help/article/components/section/help-article-metadata';
import { activateRequestLocale, type LocaleParams } from '@/i18n/page';

/**
 * S-33 — Help article · VI, CA · UC-181 · Content (§4.6)
 *
 * **This file is a shell** (`shell-composes-only`): it pins the locale and hands the section the article the address
 * names. `HelpArticle` reads it and answers the 404 for one not in force — an unpublished version has no address
 * (FR-61 AC-2). **No route-level `loading.tsx`**, for S-30's reason: a 404 must not follow a flushed 200.
 */
type Props = {
  params: Promise<{ locale: string; article: string }>;
};

export const generateMetadata = generateHelpArticleMetadata;

export default async function HelpArticlePage({ params }: Props) {
  const { article } = await params;
  const locale = await activateRequestLocale(params as unknown as LocaleParams);
  return <HelpArticle articleKey={article} locale={locale} />;
}
