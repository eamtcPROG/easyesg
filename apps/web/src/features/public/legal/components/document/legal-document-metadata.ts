import type { Locale } from '@easyesg/i18n';
import { getTranslations } from 'next-intl/server';
import { isLegalDocument } from '../../tools/legal-documents';

/**
 * Each legal document's tab title — its own name (WCAG 2.4.2), read with the locale the address carries, since
 * metadata resolves outside the page render where `setRequestLocale`'s pin does not reach. An address naming no
 * document of the set takes no title of its own; the page answers the 404.
 */
export async function generateLegalDocumentMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; document: string }>;
}): Promise<{ title?: string }> {
  const { locale, document } = await params;
  if (!isLegalDocument(document)) return {};
  const t = await getTranslations({ locale, namespace: 'legal.documents' });
  return { title: t(document) };
}
