/**
 * Whether a support request is on record under a reference (task 77; FR-78, FR-212; `architecture.md` §12.5.6's task-77
 * row (2), (9)) — what `platform/support-access` asks before a Platform Administrator's request to read an
 * organization's reports may cite a ticket. In `contracts/` so `platform/support`, which keeps the requests, and
 * `platform/support-access`, which cites them, import neither each other.
 *
 * **A request purged after its 24 months is no longer on record** (§12.5.7), so a grant cannot cite one.
 */
export interface SupportTickets {
  isOnRecord(query: { readonly reference: string }): Promise<boolean>;
}

/** DI token beside the interface, so a consumer imports one thing (P-7). */
export const SUPPORT_TICKETS = Symbol('SUPPORT_TICKETS');
