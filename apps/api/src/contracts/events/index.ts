/**
 * Cross-context event contracts.
 *
 * These are the payload types of `audit.outbox_event` rows. Only events that genuinely
 * cross a bounded-context boundary belong here — intra-billing events such as
 * OrderPlaced stay inside `modules/billing`.
 */

export interface EntitlementChanged {
  organizationId: string;
  /** Keys whose decision may now differ. Consumers re-check rather than trusting a diff. */
  affectedKeys: string[];
  occurredAt: string;
  correlationId: string;
}

export interface SubscriptionLapsed {
  organizationId: string;
  /**
   * FR-104: nothing is deleted on lapse. Out-of-entitlement content becomes read-only
   * and previously generated documents stay downloadable.
   */
  effectiveAt: string;
  correlationId: string;
}

export interface ConfigurationPublished {
  artefactType: string;
  version: number;
  /** AD-4: the version poll is the authority; a pub/sub hint is only latency. */
  occurredAt: string;
  correlationId: string;
}

export interface ReportCompleted {
  organizationId: string;
  reportId: string;
  occurredAt: string;
  correlationId: string;
}
