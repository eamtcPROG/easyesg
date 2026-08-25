/**
 * The membership as it crosses the store port — FR-12, FR-56 … FR-60 (task 25.1). Not a TypeORM
 * entity (AD-14 constraint 1), and instants are `Date`: epoch-ms is the wire's representation,
 * converted at the DTO boundary (OQ-50).
 */

/**
 * The role a member holds **in one organization** — the closed vocabulary of the migration's
 * `membership_role_known` CHECK, mirrored here as the house `as const` pattern.
 *
 * The three are `functional_requirements.md`'s data model ("edit / view-only / Organization
 * Administrator"), which architecture.md §6.5 restates as the single role FR-57 assigns at
 * invitation. A member holds exactly one of them per organization and may hold different ones in
 * different organizations (FR-12).
 *
 * **CA is deliberately not a member of this set.** actors.md is explicit that Common Access is
 * "not a role and not a permission level" but the account, credential and membership capabilities
 * every authenticated user holds regardless of which role they occupy — so adding it here would
 * make "no role" representable as a role, and every authorization check would have to special-case
 * the one value that grants nothing.
 *
 * **Per-report rights are not here either, and that is closed rather than pending** (§6.5,
 * 18 Aug 2026): the rights on a report are computed per request from this role, the state of the
 * report's period, and the entity it belongs to. No functional requirement creates a per-report
 * grant, and `design_spec.md` has no screen for managing one.
 */
export const MEMBERSHIP_ROLE = {
  /** RC with edit rights — fills in B1–B11, runs the calculator, exports (UC-17 … UC-48). */
  EDITOR: 'editor',
  /** RC without them: the same screens, no edit affordances (UC-17). */
  VIEWER: 'viewer',
  /** OA — the organization, its entities, its periods, its members and its plan (UC-49 … UC-67). */
  ORGANIZATION_ADMINISTRATOR: 'organization_administrator',
} as const;

export type MembershipRole = (typeof MEMBERSHIP_ROLE)[keyof typeof MEMBERSHIP_ROLE];

/**
 * Whether the membership still grants access — the `membership_status_known` CHECK's vocabulary.
 *
 * FR-59 removes a member's access "without deleting their account or their historical
 * contributions", and this is how: the row stays and stops granting. What that buys beyond
 * `core.field_change`'s attribution — which survives regardless, its `actor_id` carrying no
 * foreign key for exactly this reason — is the membership's **own** history: when the role was
 * granted, by whom, and when it was withdrawn. An assurance reviewer asking who could see this
 * data in March is asking that question, and a deleted row cannot answer it.
 *
 * `pending` is **not** a member. S-16 shows "active or pending invitation" as one list, but a
 * pending invitation is an `identity.invitation` row (FR-11, FR-57, task 26.1) and not a member
 * of anything — the union happens in the read model, where the screen actually makes it.
 */
export const MEMBERSHIP_STATUS = {
  ACTIVE: 'active',
  /** UC-63 — access withdrawn. The row remains; `removedAt` says when. */
  REMOVED: 'removed',
} as const;

export type MembershipStatus = (typeof MEMBERSHIP_STATUS)[keyof typeof MEMBERSHIP_STATUS];

export interface Membership {
  readonly id: string;
  readonly accountId: string;
  readonly organizationId: string;
  readonly role: MembershipRole;
  readonly status: MembershipStatus;
  /** Non-null exactly when `status` is `removed` — the `membership_removed_at_matches_status` CHECK. */
  readonly removedAt: Date | null;
  /**
   * FR-56's "last activity", surfaced by UC-59's list. Null until the member's first request
   * against this organization: someone invited and not yet returned genuinely has none, and
   * answering with `createdAt` would report a fact about the invitation instead.
   */
  readonly lastActiveAt: Date | null;
  readonly createdAt: Date;
}
