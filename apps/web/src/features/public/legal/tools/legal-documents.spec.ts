import { LEGAL_DOCUMENT } from '@easyesg/i18n';
import { describe, expect, it } from 'vitest';
import { legalDocumentHref } from './legal-documents';

/** The legal set (FR-205; 182/121): each document at the address the footer already links. */
describe('the legal set’s addresses', () => {
  /** The footer's three links and the peer strip must reach the same addresses. */
  it('addresses each document where the footer links it', () => {
    expect(Object.values(LEGAL_DOCUMENT).map(legalDocumentHref)).toEqual(['/legal/terms', '/legal/privacy', '/legal/cookies']);
  });
});
