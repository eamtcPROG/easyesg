import { DomainError } from '@api/app/filters/domain.error';
import { ProblemType, type ProblemTypeSlug } from '@api/app/filters/problem-types';

/**
 * Invitation failures, as `DomainError`s carrying message keys (see `account.errors.ts`, whose
 * header this file inherits).
 *
 * **None of these discloses anything the caller could not already see.** Every route on
 * `InvitationsController` is Organization Administrator only, and an administrator can read their
 * own organization's members (S-16) and its outstanding invitations from the same screen. So
 * "they already have access" and "an invitation is outstanding" both describe rows the caller is
 * looking at — this is not NFR-64's enumeration surface, which guards *unauthenticated* paths where
 * the response is the only channel available.
 */

/**
 * UC-60 refused: the invited address already belongs to an active member of this organization.
 *
 * `409` rather than a validation finding, because nothing about the submitted address is invalid —
 * it is the *organization's* state that refuses it, which is the same reading `LastAdministratorError`
 * takes of FR-60. The resolving action NFR-79 requires is "they already have access", so the
 * administrator stops looking for a delivery problem.
 */
export class AlreadyMemberError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.AlreadyMember;
  readonly status = 409;

  constructor() {
    super('identity.invitation.already_member');
  }
}

/**
 * UC-60 refused: an invitation to this address is already outstanding in this organization
 * (§12.5.6's task-26.1 collision row).
 *
 * Raised from the partial unique index rather than from a prior read, for `RegisterAccount`'s
 * reason: two simultaneous invitations of one address both pass a read-then-write check and one of
 * them is wrong. The database is what holds the rule; this is its translation.
 *
 * **It covers an expired-but-unrevoked invitation too**, and the message is still the right one — a
 * resend rotates the token and restarts the seven days, which is exactly what an expired invitation
 * needs. The administrator can see the row on S-16, because the list publishes precisely what this
 * index constrains.
 */
export class InvitationAlreadyPendingError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.InvitationOutstanding;
  readonly status = 409;

  constructor() {
    super('identity.invitation.already_pending');
  }
}

/**
 * No outstanding invitation of this organization has that id — it was accepted, revoked, or belongs
 * to another tenant.
 *
 * Another tenant's invitation id reaches this too, and that is the point: RLS returns no row, so
 * "not yours" and "not there" are one answer rather than two. A distinction would turn resend and
 * revoke into a cross-tenant existence oracle, exactly as `MemberNotFoundError` records.
 */
export class InvitationNotFoundError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.NotFound;
  readonly status = 404;

  constructor() {
    super('identity.invitation.not_found');
  }
}
