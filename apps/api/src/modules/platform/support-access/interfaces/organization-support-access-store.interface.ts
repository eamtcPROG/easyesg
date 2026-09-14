import type {
  SupportAccessDecisionKind,
  SupportAccessHistory,
  SupportAccessRequestRecord,
} from '../models/support-access-request.model';

export const ORGANIZATION_SUPPORT_ACCESS_STORE = Symbol('ORGANIZATION_SUPPORT_ACCESS_STORE');

/**
 * The organization's side of support access (task 67.9) — on the tenant request's own transaction, so the
 * log's policies scope every read and write to the bound organization, and a decision row carries the
 * bound member as its actor.
 */
export interface OrganizationSupportAccessStore {
  /** Every request raised with the organization at or after `since`, with the rows answering them. */
  history(query: { readonly since: Date }): Promise<SupportAccessHistory>;

  /**
   * One request and its rows, with every other decision against it held back until this transaction
   * ends — so two administrators answering at once decide in turn. `null` when the organization has no
   * such request.
   */
  lock(query: { readonly requestId: string }): Promise<SupportAccessHistory | null>;

  /** A grant, decline or end by the bound member. */
  record(decision: {
    readonly request: SupportAccessRequestRecord;
    readonly kind: SupportAccessDecisionKind;
    readonly actorId: string;
    readonly at: Date;
  }): Promise<void>;
}
