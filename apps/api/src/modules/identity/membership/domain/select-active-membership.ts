import type { AccountMembership } from '../models/membership.model';

export interface ActiveMembershipSelection {
  /** Every organization the account is an active member of — `listForAccount`'s answer. */
  readonly memberships: readonly AccountMembership[];
  /**
   * What the session says was active — `identity.session.active_organization_id` (task 25.1),
   * written by 25.4's post-sign-in branch and by the global-tier switcher (30.1). Null on a session
   * that has not chosen yet.
   */
  readonly preferredOrganizationId: string | null;
}

/**
 * Which organization a request acts for — **the shape task 28's `AuthGuard` resolves, decided here
 * rather than inside a guard**, which is 25.3's stated deliverable.
 *
 * A guard is the worst place for these rules to live: it cannot be exercised without a session, a
 * database and an HTTP request, so the three interesting cases below would each be reachable only
 * through a full integration test, and two of them would therefore never be written. As a function
 * over two values they are seven lines of spec.
 *
 * The rules, and the reasoning for the one that is a judgement call:
 *
 *  - **A preference that still names an active membership wins.** This is the ordinary case and the
 *    whole reason the session carries a column at all.
 *  - **No preference and exactly one membership selects it.** Almost every user (`use_cases.md`
 *    UC-16: "most users will have exactly one membership"), and asking someone to choose from a
 *    list of one is a screen that exists to be dismissed.
 *  - **No preference and several selects nothing.** The active organization is a deliberate choice
 *    (UX-2), so the answer is the organization-choice branch, not a guess.
 *  - **A stale preference degrades to no preference rather than to the first membership.** The
 *    session names an organization the account is no longer an active member of — removed under
 *    FR-59, or the row is simply gone. Silently landing them in a *different* tenant is how someone
 *    edits the wrong organization's report believing they are in the one they chose; with several
 *    memberships they are asked to choose again, and with one there is nothing to be ambiguous
 *    about. This is the rule a guard would have got wrong, because `?? memberships[0]` is the
 *    shorter line.
 *
 * Returning `null` covers three distinguishable situations — no memberships, several with no
 * choice, several with a stale choice — and deliberately does not distinguish them: the caller
 * holds `memberships` and can tell them apart, which is exactly what 25.4's §4.3 branch does.
 */
export const selectActiveMembership = (
  selection: ActiveMembershipSelection,
): AccountMembership | null => {
  const preferred = selection.preferredOrganizationId;
  if (preferred !== null) {
    const chosen = selection.memberships.find((m) => m.organizationId === preferred);
    if (chosen !== undefined) return chosen;
  }
  return selection.memberships.length === 1 ? selection.memberships[0] : null;
};
