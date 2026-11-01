/**
 * Membership vocabularies (FR-12, FR-56 … FR-60; tasks 25.1, 25.2) — the consumer-side
 * declarations of values `apps/api` derives from its own `MEMBERSHIP_ROLE` and `MEMBERSHIP_STATUS`
 * objects.
 *
 * Two copies for `PROBLEM_TYPE`'s stated reason, which `social.ts` and `invitation.ts` restate:
 * the api **produces** this package and must never import it, so this is a mirror changed together
 * with its source by hand — and the OpenAPI enums generated from the api's copy are what the diff
 * gate holds both against. A drift here is a failing `openapi:check`, not a silent divergence.
 *
 * The generated types already give the unions; what these add is the **runtime** values, which is
 * what S-16 needs to build a role filter, a role select and a status chip without writing the
 * literals at each site.
 */

/**
 * The role a member holds **in one organization**.
 *
 * CA is deliberately absent, as it is in the api's copy: `actors.md` is explicit that Common Access
 * is not a role but the capabilities every authenticated account holds regardless of which role it
 * occupies, so admitting it here would make "no role" representable as a role.
 */
export const MEMBERSHIP_ROLE = {
  /** Fills in B1–B11, runs the calculator, exports (UC-17 … UC-48). */
  EDITOR: 'editor',
  /** The same screens without the edit affordances (UC-17). */
  VIEWER: 'viewer',
  /** The organization, its entities, its periods, its members and its plan (UC-49 … UC-67). */
  ORGANIZATION_ADMINISTRATOR: 'organization_administrator',
} as const;

export type MembershipRole = (typeof MEMBERSHIP_ROLE)[keyof typeof MEMBERSHIP_ROLE];

/**
 * The roles an **invitation** may carry — FR-57's "edit or view-only".
 *
 * Derived from `MEMBERSHIP_ROLE` rather than restated, so the two cannot disagree about how a role
 * is spelled. Organization Administrator is not invitable: UC-64 promotes an existing member, which
 * keeps the promotion a decision taken about someone the organization already knows.
 */
export const INVITED_ROLE = {
  EDITOR: MEMBERSHIP_ROLE.EDITOR,
  VIEWER: MEMBERSHIP_ROLE.VIEWER,
} as const;

export type InvitedRole = (typeof INVITED_ROLE)[keyof typeof INVITED_ROLE];

/**
 * Whether a membership still grants access.
 *
 * `GET /members` answers `active` on every row — a removed membership is history, kept so an
 * assurance reviewer can ask who had access in March and get an answer (FR-59). The vocabulary is
 * published anyway because the wire carries the field, and a screen that assumed one value would
 * be reading a constant it did not declare.
 */
export const MEMBERSHIP_STATUS = {
  ACTIVE: 'active',
  /** UC-63 — access withdrawn. The row remains; it simply stops granting. */
  REMOVED: 'removed',
} as const;

export type MembershipStatus = (typeof MEMBERSHIP_STATUS)[keyof typeof MEMBERSHIP_STATUS];
