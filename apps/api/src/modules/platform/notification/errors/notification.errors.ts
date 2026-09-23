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

/**
 * A preference write named a `(category, channel)` pair the read does not offer — a mandatory category, a channel the
 * category does not travel on, or a category no tenant account receives (task 52.1; FR-163, BR-NOT-2; §12.5.6's
 * task-52.1 row (4)).
 *
 * **Refused whole, and nothing is written**: S-27 never draws such a switch, so the write came from a stale screen or
 * another client, and saving the rest would report a Record saved that was not saved as sent. **400**, the api's
 * answer to *what the caller sent does not belong to it* (`UnknownDisclosureElementError`).
 */
export class NotificationPreferenceNotOfferedError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.ValidationFailed;
  readonly status = 400;

  constructor() {
    super('platform.notification.preference_not_offered');
  }
}
