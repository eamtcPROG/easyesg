import { ROUTES } from '@/lib/routes';

/**
 * The legal set (FR-205; 182/121): the terms of service, the privacy notice and the cookie policy — three, the
 * prototype's data processing agreement and sub-processor list not being published. A document's value is its address
 * segment, `/legal/<document>`, which the footer has linked since task 20.
 */
export const LEGAL_DOCUMENT = {
  TERMS: 'terms',
  PRIVACY: 'privacy',
  COOKIES: 'cookies',
} as const;

export type LegalDocument = (typeof LEGAL_DOCUMENT)[keyof typeof LEGAL_DOCUMENT];

const DOCUMENTS: ReadonlySet<string> = new Set(Object.values(LEGAL_DOCUMENT));

/** Whether an address segment names one of the three — anything else is a page that does not exist. */
export const isLegalDocument = (segment: string): segment is LegalDocument => DOCUMENTS.has(segment);

/** Where a document is read: the footer's own routes, so the peer strip and the footer cannot disagree. */
const HREF: Readonly<Record<LegalDocument, string>> = {
  [LEGAL_DOCUMENT.TERMS]: ROUTES.LEGAL_TERMS,
  [LEGAL_DOCUMENT.PRIVACY]: ROUTES.LEGAL_PRIVACY,
  [LEGAL_DOCUMENT.COOKIES]: ROUTES.LEGAL_COOKIES,
};

export const legalDocumentHref = (document: LegalDocument): string => HREF[document];
