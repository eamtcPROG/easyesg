import { DomainError } from '@api/app/filters/domain.error';
import { ProblemType, type ProblemTypeSlug } from '@api/app/filters/problem-types';

/**
 * The interim seat ceiling's refusals (task 142; `architecture.md` §12.5.6's task-142 row).
 *
 * **In `identity/access` because a seat is the union's**, which is this module's subject: the gates
 * that raise these, `IssueInvitation` and `AcceptInvitation`, live in `identity/invitation`, and they
 * refuse about a number neither of that module's aggregates holds alone.
 *
 * **The problem type is `entitlement-quota-exceeded`, deliberately the one task 54.2 will raise.** A
 * client branches on the type, and design_spec.md's S-16 entry says *what 54.2 changes is the source
 * of the allowance, not this screen* — so the interim ceiling speaks the entitlement vocabulary it is
 * standing in for, and the swap changes no client. `409`, on `AlreadyMemberError`'s reading: nothing
 * about the request is invalid; the organization's state refuses it.
 */

export interface SeatCount {
  /** The ceiling in force. FR-102's *limit*, and `EntitlementDecision.limit`'s name. */
  readonly limit: number;
  /** Seats held as the refusal leaves them — the refused write excluded, since it rolls back. */
  readonly used: number;
}

/**
 * UC-60 refused: every seat is held, so the invitation would take one past the ceiling (UX-50,
 * FR-102).
 *
 * **It carries `limit` and `used` as extension members**, which is what FR-102 asks a quota block to
 * state and what S-16's gate reads — the administrator is looking at the list those numbers count, so
 * nothing is disclosed that the screen does not already show. The way out names revoking an
 * invitation or removing someone's access, because a lapsed invitation holds a seat too and no plan
 * exists to upgrade to — FR-102's upgrade path is deferred for this ceiling (its note), which is not
 * the same as UX-50 permitting it absent.
 */
export class SeatAllowanceReachedError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.EntitlementQuotaExceeded;
  readonly status = 409;

  constructor(count: SeatCount) {
    super('identity.seats.allowance_reached', { limit: count.limit }, { ...count });
  }
}

/**
 * UC-15 refused: the organization is already over its ceiling, so accepting would create a
 * membership beyond it.
 *
 * **Reachable only when the ceiling was lowered after the invitation was issued** — an invitation
 * takes its seat the moment it is sent, so an ordinary acceptance at a full organization moves no
 * count and is admitted. That is what keeps UC-60's gate from punishing an invitee for the
 * inviter's organization: the invitee is refused only when the organization has broken its own
 * ceiling since.
 *
 * **No extension members, unlike the administrator's refusal.** The caller holds a link, not a
 * membership, and an organization's head count is not something a link entitles its bearer to read.
 * The invitation is left pending — the refusal rolls the acceptance back whole — so the same link
 * works once a seat is freed, which is the way out the message names.
 */
export class AcceptanceBeyondSeatAllowanceError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.EntitlementQuotaExceeded;
  readonly status = 409;

  constructor() {
    super('identity.seats.acceptance_refused');
  }
}

/**
 * Either gate refused because the ceiling itself could not be read — the artefact absent or
 * malformed.
 *
 * **Fail closed, decided 13 Sep 2026** (§12.5.6): admitting the write would reinstate the unbounded
 * collection task 142 removes, silently, where this refusal is loud and names a retry. `503` rather
 * than `500`: nothing is broken in the request, the service's own configuration is momentarily
 * unusable, and an operator publishing a valid revision restores it within the store's poll.
 */
export class SeatAllowanceUnavailableError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.SeatAllowanceUnavailable;
  readonly status = 503;

  constructor() {
    super('identity.seats.unavailable');
  }
}
