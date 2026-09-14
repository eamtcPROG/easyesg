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
