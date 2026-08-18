/**
 * The entitlement port (AD-5).
 *
 * This is the ONLY way the compliance core learns anything about plan or price. It is
 * defined here, implemented in `modules/billing/entitlement`, and consumed by
 * `modules/core/**` — which may not import billing directly (DR-1).
 *
 * Deliberately a KEY LOOKUP, not a method per feature. A method per gated capability
 * would make NFR-17 false by construction: adding a capability would mean changing the
 * entitlement service. Here a new gated capability is a new key in the plan catalogue,
 * and a new plan is new data.
 */

export type EntitlementDecisionKind = 'allow' | 'deny' | 'allow_with_warning';

export interface EntitlementDecision {
  kind: EntitlementDecisionKind;
  /** Message key resolved through platform/localization — never a literal sentence. */
  reasonKey?: string;
  /** Current ceiling for the key, where one applies. FR-102 requires it be stated. */
  limit?: number;
  /** Consumption counted against `limit`, from the metering stream (FR-105). */
  used?: number;
  /** What the caller could buy to proceed. FR-102 requires the upgrade path be offered. */
  upgradePathKey?: string;
}

/**
 * Registered keys named in the sources (architecture.md §4.6). The set is open —
 * adding one is configuration, not code — but these are the ones the MVP gates on.
 */
export const ENTITLEMENT_KEYS = [
  'report.export.pdf',
  'org.entities.max',
  'org.seats.max',
  'api.calls.monthly',
  'module.comprehensive',
] as const;

export interface EntitlementPort {
  /**
   * NFR-41: p95 ≤ 20 ms, ≤ 100 ms on a cache miss. That budget is why the cache is
   * in-process per `api` container — a network hop would not fit.
   *
   * NFR-49: when the billing context is unreachable this must fail OPEN for keys already
   * granted and CLOSED for new purchases. An outage must not make a customer's report
   * read-only.
   */
  check(organizationId: string, key: string, requested?: number): Promise<EntitlementDecision>;
}

/** DI token. Lives beside the interface so a consumer imports one thing (CLAUDE.md, P-7). */
export const ENTITLEMENT_PORT = Symbol('ENTITLEMENT_PORT');
