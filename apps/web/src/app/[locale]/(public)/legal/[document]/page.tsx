import { LegalDocument } from '@/features/public/legal/components/document/legal-document';
import { generateLegalDocumentMetadata } from '@/features/public/legal/components/document/legal-document-metadata';
import { activateRequestLocale, type LocaleParams } from '@/i18n/page';

/**
 * S-30 — Legal documents (terms · privacy · cookies) · VI · UC-178 · Content (§4.6)
 *
 * **This file is a shell** (`shell-composes-only`): it pins the locale and hands the section the document the address
 * names. `LegalDocument` decides what answers — the cookie policy, drawn from task 75.2's inventory; *not yet
 * available* for the terms and the privacy notice until their text arrives (task 75.4); the 404 for anything else.
 */
type Props = {
  params: Promise<{ locale: string; document: string }>;
};

export const generateMetadata = generateLegalDocumentMetadata;

export default async function LegalDocumentPage({ params }: Props) {
  const { document } = await params;
  await activateRequestLocale(params as unknown as LocaleParams);
  return <LegalDocument document={document} />;
}
