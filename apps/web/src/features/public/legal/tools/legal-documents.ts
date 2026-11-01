import { LEGAL_DOCUMENT, type LegalDocument } from '@easyesg/i18n';
import { ROUTES } from '@/lib/routes';

/**
 * Where each document of the legal set is read: the footer's own routes, so the peer strip and the footer cannot
 * disagree. The set itself — its vocabulary and each document's standing — is `@easyesg/i18n`'s since task 195, which
 * the api reads too; what is left here is the one fact about it that is this application's, its addresses.
 */
const HREF: Readonly<Record<LegalDocument, string>> = {
  [LEGAL_DOCUMENT.TERMS]: ROUTES.LEGAL_TERMS,
  [LEGAL_DOCUMENT.PRIVACY]: ROUTES.LEGAL_PRIVACY,
  [LEGAL_DOCUMENT.COOKIES]: ROUTES.LEGAL_COOKIES,
};

export const legalDocumentHref = (document: LegalDocument): string => HREF[document];
