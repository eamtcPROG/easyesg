import { FocusColumn } from '@easyesg/ui';
import { notFound } from 'next/navigation';
import { readLegalController } from '@/server/data/legal-controller';
import { NotYetAvailable } from '@/shared/not-yet-available';
import { LEGAL_CONTROLLER_READ, readLegalControllerOutcome } from '../../tools/legal-controller-read';
import { LEGAL_DOCUMENT, isLegalDocument } from '../../tools/legal-documents';
import { CookiePolicy } from '../cookie-policy/cookie-policy';
import { PrivacyNotice } from '../privacy/privacy-notice';
import { LegalUnavailable } from '../shared/legal-unavailable';
import { TermsOfService } from '../terms/terms-of-service';

/**
 * S-30's one region (FR-205; tasks 75.3, 75.4): which of the legal set's documents an address names, and what answers
 * for it. **The section reads and the documents render**: the cookie policy names no operator and reads nothing; the
 * terms and the privacy notice name the platform operator, read here once.
 *
 * - **An address naming no document of the set does not exist**, so it answers the 404 — the set is three (182/121).
 * - **No operator in force answers *not yet available*** (task 103), the `architecture.md` §12.5.6 task-75 row (7)'s rule
 *   that no document naming a missing controller goes live — AC-13.
 * - **A read that failed keeps the frame** with a callout in the text's place — the archetype's *error — recoverable*.
 */
export async function LegalDocument({ document }: { readonly document: string }) {
  if (!isLegalDocument(document)) notFound();
  if (document === LEGAL_DOCUMENT.COOKIES) return <CookiePolicy />;

  const read = readLegalControllerOutcome(await readLegalController());
  switch (read.kind) {
    case LEGAL_CONTROLLER_READ.NONE_IN_FORCE:
      return (
        <FocusColumn>
          <NotYetAvailable />
        </FocusColumn>
      );
    case LEGAL_CONTROLLER_READ.FAILED:
      return <LegalUnavailable document={document} />;
    case LEGAL_CONTROLLER_READ.READY:
      return document === LEGAL_DOCUMENT.TERMS ? (
        <TermsOfService controller={read.controller} />
      ) : (
        <PrivacyNotice controller={read.controller} />
      );
  }
}
