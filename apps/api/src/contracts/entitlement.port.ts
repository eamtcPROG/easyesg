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

/**
 * AD-5's three decisions, as an `as const` object with the union derived (CLAUDE.md,
 * "Conventions"). Closed, unlike the entitlement KEYS below — the keys are configuration and
 * deliberately open (NFR-17), while the outcomes of a check are fixed by the design.
 *
 * `allow_with_warning` is the member CLAUDE.md's user-facing-text rule names by example, so it
 * is worth restating where it is declared: this value is compared and stored, and it never
 * reaches a screen. FR-102's wording travels as `reasonKey` below.
 */
export const ENTITLEMENT_DECISION_KIND = {
  ALLOW: 'allow',
  DENY: 'deny',
  ALLOW_WITH_WARNING: 'allow_with_warning',
} as const;

export type EntitlementDecisionKind =
  (typeof ENTITLEMENT_DECISION_KIND)[keyof typeof ENTITLEMENT_DECISION_KIND];

/**
 * One entitlement question. Named rather than positional (CLAUDE.md, "Conventions"): the first
 * two arguments were both `string`, and swapping an organization id for an entitlement key
 * compiles — it would resolve to "no such key", which AD-5 answers as a deny, so the failure is a
 * customer refused a capability they hold. Converted before the port has an implementation
 * (task 54), which is the cheapest moment it will ever be.
 */
export interface EntitlementQuery {
  readonly organizationId: string;
  readonly key: string;
  /** Units the caller wants to consume, where the key is metered. */
  readonly requested?: number;
}

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
  check(query: EntitlementQuery): Promise<EntitlementDecision>;
}

/** DI token. Lives beside the interface so a consumer imports one thing (CLAUDE.md, P-7). */
export const ENTITLEMENT_PORT = Symbol('ENTITLEMENT_PORT');
