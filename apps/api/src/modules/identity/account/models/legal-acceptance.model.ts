import type { AcceptedLegalDocument } from '@easyesg/i18n';

/**
 * An account's acceptance of the terms of service and the privacy notice, as it crosses the store port (task 195;
 * §12.5.6's task-195 row (5)).
 *
 * **The latest version accepted, per document** — absent where the account has accepted none. That is what the gate
 * judges and what S-43 says, and it is all a read needs: every earlier row is kept for the record, not for a decision.
 */
export type AcceptedLegalVersions = Readonly<Partial<Record<AcceptedLegalDocument, string>>>;

/** One document accepted at one version — a row of `identity.legal_acceptance`. */
export interface LegalAcceptanceEntry {
  readonly document: AcceptedLegalDocument;
  readonly version: string;
}

/** What recording an acceptance hands the store. One row per entry, all at the same instant. */
export interface NewLegalAcceptance {
  readonly accountId: string;
  readonly accepted: readonly LegalAcceptanceEntry[];
  readonly at: Date;
}

/** A document the account owes an acceptance of: the version in force, and the one it accepted, where it accepted one. */
export interface OwedLegalDocument {
  readonly document: AcceptedLegalDocument;
  readonly version: string;
  readonly acceptedVersion: string | null;
}
