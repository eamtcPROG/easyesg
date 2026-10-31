import { HelpArticle } from '@/features/public/help/article/components/section/help-article';
import { generateHelpArticleMetadata } from '@/features/public/help/article/components/section/help-article-metadata';
import { activateRequestLocale, type LocaleParams } from '@/i18n/page';
import { readSession } from '@/server/session/session';

/**
 * S-33 — Help article · VI, CA · UC-181 · Content (§4.6), as artboard 03 draws it (task 227)
 *
 * **This file is a shell** (`shell-composes-only`): it pins the locale and hands the section the article the address
 * names, the help's language it chose (UX-4), and whether the reader is signed in — read beside the session, since
 * nothing under `features/public` reads one (§12.5.6's task-77 row (10)). `HelpArticle` reads the article and answers
 * the 404 for one not in force — an unpublished version has no address (FR-61 AC-2). **No route-level `loading.tsx`**,
 * for S-30's reason: a 404 must not follow a flushed 200.
 */
type Props = {
  params: Promise<{ locale: string; article: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const generateMetadata = generateHelpArticleMetadata;

export default async function HelpArticlePage({ params, searchParams }: Props) {
  const page = await activateRequestLocale(params as unknown as LocaleParams);
  const [{ article }, { content }, session] = await Promise.all([params, searchParams, readSession()]);
  return (
    <HelpArticle
      articleKey={article}
      page={page}
      requestedContent={typeof content === 'string' ? content : undefined}
      signedIn={session !== null}
    />
  );
}
