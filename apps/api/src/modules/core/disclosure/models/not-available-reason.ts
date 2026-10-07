import { DISCLOSURE_STATE, type DisclosureValueContents } from './disclosure-value.model';

/**
 * Whether a written value's state and its reason agree (task 183; `architecture.md` §12.5.6's task-182 authoring row
 * (6); FR-32, D-4) — the store's `report_disclosure_value_reason_matches_state` CHECK, asked before the write so a
 * mismatch is the reporter's 400 rather than the database's 500.
 *
 * **Three answers, because the two refusals have different remedies**: a *not available* answer needs a reason the
 * reader will see, and a reason on any other state is a leftover the client should not be sending. **"Blank" is a
 * reason `trim()` leaves empty** (the row's reading, the name-part rule's): the CHECK tests `IS NOT NULL` only, so a
 * reason of spaces passed both the DTO and the database and stored a disclosure that says nothing. The reason is
 * judged, not rewritten — it is stored as the reporter wrote it.
 */
export const NOT_AVAILABLE_REASON = {
  MATCHES: 'matches',
  /** *Not available* with no reason, or one with no visible character. */
  MISSING: 'missing',
  /** A reason on a state other than *not available* — blank or not, it is what the CHECK refuses. */
  UNEXPECTED: 'unexpected',
} as const;

export type NotAvailableReasonVerdict = (typeof NOT_AVAILABLE_REASON)[keyof typeof NOT_AVAILABLE_REASON];

export const notAvailableReasonVerdict = (
  contents: Pick<DisclosureValueContents, 'state' | 'notAvailableReason'>,
): NotAvailableReasonVerdict => {
  if (contents.state === DISCLOSURE_STATE.NOT_AVAILABLE) {
    return contents.notAvailableReason?.trim() ? NOT_AVAILABLE_REASON.MATCHES : NOT_AVAILABLE_REASON.MISSING;
  }
  return contents.notAvailableReason === null ? NOT_AVAILABLE_REASON.MATCHES : NOT_AVAILABLE_REASON.UNEXPECTED;
};
