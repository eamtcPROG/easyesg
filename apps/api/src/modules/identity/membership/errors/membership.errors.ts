import { DomainError } from '@api/app/filters/domain.error';
import { ProblemType, type ProblemTypeSlug } from '@api/app/filters/problem-types';

/**
 * Membership failures, as `DomainError`s carrying message keys (see `account.errors.ts`, whose
 * header this file inherits).
 *
 * **`RequiresRoleGuard` throws two of these, and a guard throwing a `DomainError` is deliberate.**
 * `AdminOriginGuard` raises a bare `ForbiddenException` on purpose — a cross-origin forger gets a
 * status code and nothing to calibrate against. This gate is the opposite situation: the caller is
 * a legitimate signed-in colleague who opened a screen they do not hold the role for, and NFR-79
 * requires them to be told what happened and what to do about it. A bare `403` carries no problem
 * type, so the front end could not tell "you are not an administrator" from "you do not belong to
 * this organization" — two different sentences with two different resolutions.
 *
 * None of these discloses anything an actor could not already infer. Whether an organization has
 * exactly one administrator is visible to any member on S-16, and a caller who is not a member of
 * an organization is told only about their own missing membership.
 */

/**
 * The request carries no resolved actor. Distinct from the two below, because re-authenticating is
 * the resolution and holding a different role is not.
 *
 * Until task 28's `AuthGuard` exists this is what every `@RequiresRole` route answers in
 * production, which is the fail-closed half of shipping the routes ahead of their resolver.
 */
export class AuthenticationRequiredError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.AuthenticationRequired;
  readonly status = 401;

  constructor() {
    super('identity.membership.authentication_required');
  }
}

/**
 * Authenticated, but with no membership in an active organization — the state UC-49 resolves by
 * creating one and UC-15 by accepting an invitation. `403` rather than `404`: the caller exists and
 * the route exists; what is missing is a relationship they can go and establish.
 */
export class MembershipRequiredError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.MembershipRequired;
  readonly status = 403;

  constructor() {
    super('identity.membership.membership_required');
  }
}

/**
 * A member of the organization, in a role the route does not admit (FR-158, NFR-62). Every route
 * on `MembersController` requires OA: actors.md gives RC "explicitly no access to organization
 * settings, the user list, or billing/plan screens".
 */
export class InsufficientRoleError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.InsufficientRole;
  readonly status = 403;

  constructor() {
    super('identity.membership.insufficient_role');
  }
}

/**
 * No such member in the active organization. Another tenant's membership id reaches this too, and
 * that is the point: RLS returns no row, so "not yours" and "not there" are one answer here rather
 * than two — a distinction would turn this route into a cross-tenant existence oracle.
 */
export class MemberNotFoundError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.NotFound;
  readonly status = 404;

  constructor() {
    super('identity.membership.member_not_found');
  }
}

/**
 * FR-60's refusal. `409` because the request is well-formed and the *organization's* state is what
 * refuses it — nothing about the submitted role is invalid, which is why this is not a validation
 * finding.
 */
export class LastAdministratorError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.LastAdministrator;
  readonly status = 409;

  constructor() {
    super('identity.membership.last_administrator');
  }
}
