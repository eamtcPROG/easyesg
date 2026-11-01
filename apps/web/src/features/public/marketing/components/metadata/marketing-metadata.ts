import type { Locale } from '@easyesg/i18n';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { MARKETING_MESSAGES } from '../shared/marketing-messages';

/**
 * The home's title and description — the tab's name (WCAG 2.4.2) and the sentence a search result shows under it, the
 * page being the platform's landing page (OQ-31's stated assumption).
 *
 * Read with the locale the address carries, since metadata resolves outside the page render where
 * `setRequestLocale`'s pin does not reach. The canonical and the `hreflang` alternates are not here: they ride the
 * response's `Link` header (task 74.5, `src/lib/canonical-link.ts`), because this page is prerendered and an absolute
 * address in its markup would need the host at build time.
 *
 * A leaf of its own under `components/` because metadata is no child of the page's `return`.
 */
export async function generateMarketingMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: MARKETING_MESSAGES });
  return { title: t('title'), description: t('description') };
}
