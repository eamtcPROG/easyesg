import { LEGAL_DOCUMENT, type AcceptedLegalDocument } from '@easyesg/i18n';

/**
 * **In `identity/shared/tools/` beside its one reader, `components/legal-acceptance-checkbox.tsx`, which more than one
 * journey reads** (task 195). Which of the acceptance's three sentences names the documents it accepts: both — S-01,
 * and S-43 for an account that accepted neither — or the one a release moved alone. The keys are
 * `identity.legalAcceptance.label`'s.
 */
export const LEGAL_ACCEPTANCE_LABEL = {
  BOTH: 'label.both',
  TERMS: 'label.terms',
  PRIVACY: 'label.privacy',
} as const;

export type LegalAcceptanceLabel = (typeof LEGAL_ACCEPTANCE_LABEL)[keyof typeof LEGAL_ACCEPTANCE_LABEL];

export const legalAcceptanceLabel = (documents: readonly AcceptedLegalDocument[]): LegalAcceptanceLabel => {
  const terms = documents.includes(LEGAL_DOCUMENT.TERMS);
  const privacy = documents.includes(LEGAL_DOCUMENT.PRIVACY);
  if (terms && privacy) return LEGAL_ACCEPTANCE_LABEL.BOTH;
  return terms ? LEGAL_ACCEPTANCE_LABEL.TERMS : LEGAL_ACCEPTANCE_LABEL.PRIVACY;
};
