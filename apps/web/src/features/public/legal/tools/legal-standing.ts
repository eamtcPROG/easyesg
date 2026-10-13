import type { LegalDate } from '@easyesg/contracts';
import { LEGAL_DOCUMENT, type LegalDocument } from './legal-documents';

/**
 * Each legal document's standing — its version, the day it applies from, and whether counsel has approved it (FR-205
 * behaviour 5 and 10, AC-4, AC-10; 182/116; `architecture.md` §12.5.6's task-75 row (9)). **Committed beside the text,
 * because the text is the release's**: the release that carries a document supplies its version and its effective
 * date, so neither can change without the words changing with them, and the version is what FR-111's checkout record
 * and task 195's acceptance record will point at.
 *
 * **The effective date is a legal date, a calendar day in Chișinău** (NFR-34), never an instant: which version was in
 * force on a day is a legal question.
 *
 * **`provisional` is true until counsel approves the text** — the release-checklist item before task 48
 * (`docs/runbooks/release-checklist.md`), which also sets the effective date and drops the marking. A platform
 * operator's details are not part of the standing: A-21 changes them without versioning the documents (row (7)).
 */
export interface LegalStanding {
  readonly version: string;
  readonly effective: LegalDate;
  readonly provisional: boolean;
}

/** The zone a legal document's effective date is a day in — the operator's, Moldova's. */
const LEGAL_TIMEZONE = 'Europe/Chisinau';

const DRAFTED: LegalStanding = {
  version: '1.0',
  effective: { date: '2026-10-13', timezone: LEGAL_TIMEZONE },
  provisional: true,
};

export const LEGAL_STANDING: Readonly<Record<LegalDocument, LegalStanding>> = {
  [LEGAL_DOCUMENT.TERMS]: DRAFTED,
  [LEGAL_DOCUMENT.PRIVACY]: DRAFTED,
  [LEGAL_DOCUMENT.COOKIES]: DRAFTED,
};
