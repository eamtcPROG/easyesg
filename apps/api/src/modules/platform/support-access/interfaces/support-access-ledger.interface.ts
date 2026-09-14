import type {
  SupportAccessHistory,
  SupportAccessRequestRecord,
} from '../models/support-access-request.model';

export const SUPPORT_ACCESS_LEDGER = Symbol('SUPPORT_ACCESS_LEDGER');

/**
 * The platform's side of support access (task 67.9) — an admin-realm request, which binds no tenant.
 *
 * **Reads bind the named organization, read-only**, so what an operator is told about a request is what
 * the organization's own policies show — never a `BYPASSRLS` read. **Writes bind nothing**: the log's
 * platform insert policy admits a request or an end only with no organization bound, and refuses a grant
 * or a decline from this side outright.
 */
export interface SupportAccessLedger {
  /**
   * The requests this operator raised with the organization at or after `since`, with the rows answering
   * them; `null` when no organization has that id.
   */
  operatorHistory(query: {
    readonly organizationId: string;
    readonly requesterId: string;
    readonly since: Date;
  }): Promise<SupportAccessHistory | null>;

  /** One request of the organization's, with its rows; `null` when it has no such request. */
  request(query: {
    readonly organizationId: string;
    readonly requestId: string;
  }): Promise<SupportAccessHistory | null>;

  recordRequest(command: {
    readonly organizationId: string;
    readonly requesterId: string;
    readonly ticketReference: string;
    readonly reason: string;
    readonly at: Date;
  }): Promise<{ readonly id: string }>;

  /** A Platform Administrator ending a running grant — any grant, by the owner's decision. */
  recordEnd(command: {
    readonly request: SupportAccessRequestRecord;
    readonly actorId: string;
    readonly at: Date;
  }): Promise<void>;
}
