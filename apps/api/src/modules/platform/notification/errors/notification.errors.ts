import { DomainError } from '@api/app/filters/domain.error';
import { ProblemType, type ProblemTypeSlug } from '@api/app/filters/problem-types';

/**
 * The centre's refusals (task 50.1.2; FR-161) — each names its resolution, per NFR-79, in the catalogue entry its
 * key points at.
 */

/**
 * The recipient holds no in-app delivery of this notice. **The same answer for a notice addressed to a colleague**
 * as for one that never existed: the policies make the two indistinguishable, and a 403 for the first would tell a
 * member that a notice addressed to someone else exists (UC-165: the centre is the notices *addressed to them*).
 */
export class NotificationNotFoundError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.NotFound;
  readonly status = 404;

  constructor() {
    super('platform.notification.not_found');
  }
}
