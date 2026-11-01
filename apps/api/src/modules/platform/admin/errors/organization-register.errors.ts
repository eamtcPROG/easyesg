import { DomainError } from '@api/app/filters/domain.error';
import { ProblemType, type ProblemTypeSlug } from '@api/app/filters/problem-types';

/** A-02's refusals (task 67.9; FR-76) — each names its resolution, per NFR-79, in its catalogue entry. */

/** No organization in the register holds this id. */
export class OrganizationNotRegisteredError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.NotFound;
  readonly status = 404;

  constructor() {
    super('platform.admin.organization_not_found');
  }
}

/**
 * The account is not an active member of this organization, or gave no phone (task 167) — one refusal for both,
 * since the record offers the control only where both hold, so either means the record the operator acted on is
 * out of date.
 */
export class MemberPhoneNotFoundError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.NotFound;
  readonly status = 404;

  constructor() {
    super('platform.admin.member_phone_not_found');
  }
}
