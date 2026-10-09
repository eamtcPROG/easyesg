import { FocusColumn } from '@easyesg/ui';
import { notFound } from 'next/navigation';
import { NotYetAvailable } from '@/shared/not-yet-available';
import { LEGAL_DOCUMENT, isLegalDocument } from '../../tools/legal-documents';
import { CookiePolicy } from '../cookie-policy/cookie-policy';

/**
 * S-30's one region (FR-205; task 75.3): which of the legal set's documents an address names, and what answers for it.
 *
 * **Only the cookie policy is drawn yet.** Its facts come from task 75.2's inventory; the text of the terms of service
 * and the privacy notice is the owner's or counsel's to supply (`architecture.md` §12.5.6's task-75 row), and until it
 * arrives those two answer §8.1's *not yet available* (task 103) — the same answer the footer's links met before. **An
 * address naming no document of the set does not exist**, so it answers the 404 rather than *not yet available*: the
 * set is three (182/121), and a fourth is not coming.
 */
export function LegalDocument({ document }: { readonly document: string }) {
  if (!isLegalDocument(document)) notFound();
  if (document === LEGAL_DOCUMENT.COOKIES) return <CookiePolicy />;
  return (
    <FocusColumn>
      <NotYetAvailable />
    </FocusColumn>
  );
}
