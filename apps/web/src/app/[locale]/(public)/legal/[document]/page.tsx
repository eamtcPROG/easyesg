import { LegalDocument } from '@/features/public/legal/components/document/legal-document';
import { generateLegalDocumentMetadata } from '@/features/public/legal/components/document/legal-document-metadata';
import { activateRequestLocale, type LocaleParams } from '@/i18n/page';

/**
 * S-30 — Legal documents (terms · privacy · cookies) · VI · UC-178 · Content (§4.6)
 *
 * **This file is a shell** (`shell-composes-only`): it pins the locale and hands the section the document the address
 * names. `LegalDocument` decides what answers — the cookie policy, drawn from task 75.2's inventory; the terms and the
 * privacy notice, naming the platform operator A-21 keeps (task 75); the 404 for anything else.
 */
type Props = {
  params: Promise<{ locale: string; document: string }>;
};

export const generateMetadata = generateLegalDocumentMetadata;

/**
 * **Rendered per request, though it sits in the one zone §14.2 lets the framework cache (task 74.4).** The terms and the
 * privacy notice name the operator A-21 keeps, read when the page is, and a change there is published within seconds
 * (§12.5.6's task-75 row (7)); a prerendered copy would name yesterday's operator until the next build.
 */
export const dynamic = 'force-dynamic';

export default async function LegalDocumentPage({ params }: Props) {
  const { document } = await params;
  await activateRequestLocale(params as unknown as LocaleParams);
  return <LegalDocument document={document} />;
}
