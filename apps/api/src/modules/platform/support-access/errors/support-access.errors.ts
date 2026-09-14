import { DomainError } from '@api/app/filters/domain.error';
import { ProblemType, type ProblemTypeSlug } from '@api/app/filters/problem-types';

/**
 * Support access's refusals (task 67.9; FR-77, FR-78) — each names its resolution, per NFR-79, in the
 * catalogue entry its key points at.
 */

/** No organization has this id — a request names one that exists. */
export class SupportAccessOrganizationNotFoundError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.NotFound;
  readonly status = 404;

  constructor() {
    super('platform.support_access.organization_not_found');
  }
}

/**
 * The operator already has a request with this organization that is waiting for an answer or running.
 * One at a time: a second would ask the organization the same question twice, and an extension is a new
 * request only once the first has ended.
 */
export class SupportAccessOutstandingError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.SupportAccessOutstanding;
  readonly status = 409;

  constructor() {
    super('platform.support_access.outstanding');
  }
}

/** No request has this id in this organization. */
export class SupportAccessRequestNotFoundError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.NotFound;
  readonly status = 404;

  constructor() {
    super('platform.support_access.request_not_found');
  }
}

/** A grant or decline for a request that is no longer waiting — answered already, or lapsed. */
export class SupportAccessNotAwaitingError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.Conflict;
  readonly status = 409;

  constructor() {
    super('platform.support_access.not_awaiting');
  }
}

/** An end for access that is not running — never granted, ended already, or past its 60 minutes. */
export class SupportAccessNotActiveError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.Conflict;
  readonly status = 409;

  constructor() {
    super('platform.support_access.not_active');
  }
}

/**
 * A read under a grant that does not permit it: the request is not this operator's, or it is not active.
 * **One answer for every reason**, as the admin console only needs to know that the window is closed — and
 * a read that told an operator whose request it was would describe another operator's access.
 */
export class SupportAccessRequiredError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.SupportAccessRequired;
  readonly status = 403;

  constructor() {
    super('platform.support_access.required');
  }
}
