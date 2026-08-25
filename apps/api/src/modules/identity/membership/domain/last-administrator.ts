import { MEMBERSHIP_ROLE, type MembershipRole } from '../models/membership.model';

/**
 * FR-60's single-admin lockout, as one predicate with two callers.
 *
 * UC-64 reads as "promote another member", which sounds like a feature. FR-60 states what it is
 * for: *"so that the departure of a sole administrator cannot lock an organization out of its own
 * settings"* — and a promotion path alone does not achieve that, because the lockout arrives by
 * the two paths that take an administrator away. **Demotion (UC-62) and removal (UC-63) are the
 * same rule**, which is why this is a domain function rather than a check inside either use case:
 * written twice, the two copies drift, and the copy that drifts is the one nobody exercised.
 *
 * `resultingRole` is `null` for removal, so the two callers differ in one argument rather than in
 * structure. The subject's *current* role is what decides whether the count is even relevant: an
 * editor being removed cannot orphan anything, however many administrators there are.
 *
 * The count is "administrators who still hold access", read inside the request transaction. That
 * placement is the rule's teeth rather than a detail — see `MembershipStore`.
 */
export interface AdministratorImpact {
  /** The role the subject holds now. */
  readonly subjectRole: MembershipRole;
  /** What the subject would hold afterwards, or `null` when access is being withdrawn. */
  readonly resultingRole: MembershipRole | null;
  /** Active administrators in the organization, the subject included. */
  readonly activeAdministrators: number;
}

const isAdministrator = (role: MembershipRole | null): boolean =>
  role === MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR;

/**
 * True when the change would leave the organization with no Organization Administrator.
 *
 * `<= 1` rather than `=== 1`: a count of zero is already the forbidden state, and a rule that
 * refuses to notice it would make the one situation needing intervention the one situation it
 * permits. That the count cannot reach zero through this API is exactly why it must not be
 * assumed — the row could arrive that way from a data fix, a restore, or a task not yet written.
 */
export const wouldLeaveNoAdministrator = (impact: AdministratorImpact): boolean =>
  isAdministrator(impact.subjectRole) &&
  !isAdministrator(impact.resultingRole) &&
  impact.activeAdministrators <= 1;
