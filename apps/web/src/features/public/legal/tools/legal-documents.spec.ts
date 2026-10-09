import { describe, expect, it } from 'vitest';
import { LEGAL_DOCUMENT, isLegalDocument, legalDocumentHref } from './legal-documents';

/** The legal set (FR-205; 182/121): three documents, each at the address the footer already links. */
describe('the legal set', () => {
  it('is three documents', () => {
    expect(Object.values(LEGAL_DOCUMENT)).toEqual(['terms', 'privacy', 'cookies']);
  });

  it('admits an address segment naming one of them, and nothing else', () => {
    for (const document of Object.values(LEGAL_DOCUMENT)) expect(isLegalDocument(document)).toBe(true);
    for (const segment of ['dpa', 'sub-processors', 'Terms', '']) expect(isLegalDocument(segment)).toBe(false);
  });

  /** The footer's three links and the peer strip must reach the same addresses. */
  it('addresses each document where the footer links it', () => {
    expect(Object.values(LEGAL_DOCUMENT).map(legalDocumentHref)).toEqual(['/legal/terms', '/legal/privacy', '/legal/cookies']);
  });
});
