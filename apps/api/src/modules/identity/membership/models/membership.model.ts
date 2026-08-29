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

/**
 * A member as UC-59 lists them (FR-56) — the membership joined to the account it grants access to.
 *
 * **The account is joined, not referenced**, because "who can see our ESG data" is unanswerable
 * from a column of identifiers: S-16 exists to be read by a person deciding whether the list is
 * right, and an OA cannot recognise a colleague from a UUID.
 *
 * Two of FR-56's four fields are honest gaps rather than omissions, and both close in a named task:
 *
 *  - **`status` is never `pending` here.** FR-56 asks for "active or pending invitation" and S-16
 *    renders one list, but a pending invitation is an `identity.invitation` row (task 26.1) and not
 *    a member of anything. The union happens in the read model when the other half exists.
 *  - **`lastActiveAt` is null until task 28.** Nothing writes `last_active_at` before `AuthGuard`
 *    resolves a request against the membership row. Serving null is the truthful answer; defaulting
 *    it to `createdAt` would report a fact about the invitation as a fact about the person.
 *
 * There is no display name, and that is FR-9's profile rather than this list's gap — registration
 * collects an address and a password and nothing else (UC-01).
 */
export interface OrganizationMember {
  readonly membershipId: string;
  readonly accountId: string;
  readonly email: string;
  readonly role: MembershipRole;
  readonly status: MembershipStatus;
  readonly lastActiveAt: Date | null;
  readonly joinedAt: Date;
}

/**
 * One of the caller's own memberships, as UC-16's *view memberships* half sees it (FR-12).
 *
 * **The mirror image of `OrganizationMember`, and the pairing is the point.** That one answers
 * "who is in this organization" and is read with a tenant bound; this one answers "which
 * organizations am I in" and is read *before* any tenant is bound — which is why it carries the
 * organization's name rather than the account's email. The two never appear in one query, and a
 * single type serving both would be a shape whose half the reader has to work out from context.
 *
 * `organizationName` is reachable at all because of `organization_directory_select` (task 25.3):
 * the tenant root is readable across memberships **only** while no organization is bound. S-05
 * lists these and the global-tier switcher chooses among them (`design_spec.md` OQ-6).
 */
export interface AccountMembership {
  readonly membershipId: string;
  readonly organizationId: string;
  readonly organizationName: string;
  readonly role: MembershipRole;
  readonly joinedAt: Date;
}

/**
 * One of the caller's own memberships, plus **which of them the current request is acting for**
 * (task 30.1).
 *
 * `AccountMembership` is what the store reads; this is what UC-16's view half answers, and the
 * extra bit is not a property of the membership at all — it is a property of the *session*, so it
 * cannot come from the row and must not be stored on one.
 *
 * **This reverses a sentence task 25.3 wrote on `AccountMembershipResponseDto`** — "No `isActive`
 * flag, deliberately … the switcher's own state comes from the same resolution that scoped the page
 * around it, not from a list item". The principle in that sentence is right and is kept; its
 * premise was that a caller could learn the resolution some other way, and no such read exists.
 * `GET /organization` is `@RequiresRole(ORGANIZATION_ADMINISTRATOR)`, so a viewer or an editor
 * cannot use it, and UX-2 requires the active organization to be visible **on every authenticated
 * screen** for every actor. So the flag is not a second answer: it is `AuthGuard`'s own resolution
 * — `selectActiveMembership`, already computed for this request and already on the request context
 * — projected onto the read that has the names. Nothing else may compute it, and nothing persists
 * it. **Reversed 29 Aug 2026, project owner**, against the alternative of a new `GET /session`
 * route, which is the API work task 83 owns.
 *
 * **`active` is false on every row when the account holds several memberships and has chosen
 * none** — `selectActiveMembership` answers null there by design (UX-2 makes the choice
 * deliberate), so the honest projection is a list with nothing marked. That is the state the
 * switcher exists to resolve.
 */
export interface AccountMembershipView extends AccountMembership {
  /** Whether THIS request resolved to this organization — the guard's answer, not the row's. */
  readonly active: boolean;
}
