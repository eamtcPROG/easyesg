import { DomainError } from '@api/app/filters/domain.error';
import { ProblemType, type ProblemTypeSlug } from '@api/app/filters/problem-types';
import { UNACCEPTABLE_STANDINGS, type UnacceptableStanding } from '../domain/invitation-standing';

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

/**
 * UC-15 refused: the link is spent, withdrawn, lapsed, or names no invitation at all (task 26.2).
 *
 * **It carries the standing as a problem extension**, because S-03 draws expired, already-used and
 * revoked as three distinguishable recoverable states and a front end cannot branch on wording —
 * the same argument that gave `last-administrator` and `already-member` their own slugs. One slug
 * with a discriminating member was chosen over four slugs because the four share a resolution
 * shape: ask the administrator to send a new invitation. The member says which sentence to show;
 * the slug says what kind of failure it is.
 *
 * The message key is per standing, so each of the four gets NFR-79's three parts in its own words
 * rather than one sentence hedged to cover all of them.
 *
 * `410 Gone` rather than `404`: the caller presented a token that either was valid and is no longer,
 * or never was, and RFC 9110 makes `410` the status for a resource deliberately and permanently
 * withdrawn. It is also the one that tells a client not to retry, which is true of every value here
 * — a resend produces a *new* link, never a working version of this one.
 */
export class InvitationNotAcceptableError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.InvitationNotAcceptable;
  readonly status = 410;

  constructor(readonly standing: UnacceptableStanding) {
    // The third argument is `DomainError`'s extension bag, which `ProblemDetailsFilter` spreads
    // into the document — the mechanism FR-102's limit and allowance already use. Overriding the
    // property with a getter would shadow a field the base class assigns in its constructor.
    super(`identity.invitation.standing.${standing}`, undefined, { standing });
  }
}

/**
 * UC-15 refused: the caller is signed in as an account the invitation does not name (FR-11).
 *
 * The binding is the requirement's own content — "an organization invitation **bound to the invited
 * email address**" — and UC-15's business rule states the case it exists for: a social sign-in is
 * accepted only where the provider asserts that same address. S-03 draws this as its permission
 * error, distinct from the recoverable three above, because the resolution is different: sign in as
 * the invited person, or ask for an invitation to the address you actually use.
 *
 * **It discloses the invited address to nobody who did not already have it.** The caller is holding
 * the link, and the link was emailed to that address; the message names it so the person can tell
 * which of their two mailboxes to use, which is the resolving action NFR-79 requires.
 *
 * `403` rather than `410`: the invitation is perfectly good, and someone else can accept it.
 */
export class InvitationNotYoursError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.InvitationAddressMismatch;
  readonly status = 403;

  constructor() {
    super('identity.invitation.address_mismatch');
  }
}

/**
 * Every message key the standing error can resolve, derived from the vocabulary rather than listed.
 *
 * It exists so a spec can assert the catalogue answers all of them in all three locales: the key is
 * built by interpolation at the throw site, so a standing added later would compile, ship, and
 * render a problem document with **no `detail` at all** — `ProblemDetailsFilter` omits a member
 * whose key is missing rather than falling back to the slug, which is right for the reader and
 * silent for everyone else.
 */
export const INVITATION_STANDING_KEYS = UNACCEPTABLE_STANDINGS.map(
  (standing) => `identity.invitation.standing.${standing}`,
);
