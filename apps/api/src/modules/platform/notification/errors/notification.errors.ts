import { DomainError } from '@api/app/filters/domain.error';
import { ProblemType, type ProblemTypeSlug } from '@api/app/filters/problem-types';
import type { PublicationRefusal } from '../models/category-console.model';

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

/**
 * A one-click unsubscribe whose link cannot switch anything off — not signed by this platform, or naming a category
 * that may no longer be switched off (task 52.2.2; FR-169). **400**: what was sent does not belong to anyone's
 * preferences. One refusal for both causes, `UNSUBSCRIBE_STANDING.UNUSABLE`'s reason, and its wording's way out is
 * S-27, which the reader can reach whichever it was.
 */
export class UnsubscribeLinkUnusableError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.ValidationFailed;
  readonly status = 400;

  constructor() {
    super('platform.notification.unsubscribe_link_unusable');
  }
}

/**
 * A-17 published against a revision no longer in force — another operator saved first (task 67.10; the task-67.11
 * row's rule). **409, its own slug**, so the console redraws what is in force rather than the refusal over stale values.
 */
export class NotificationCategoryChangedError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.NotificationCategoryChanged;
  readonly status = 409;

  constructor() {
    super('platform.notification.category_changed');
  }
}

/** A-17 refused a behaviour a rule in code forbids (task 67.10) — the message key names which. Nothing was published. */
export class NotificationCategoryRefusedError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.ValidationFailed;
  readonly status = 400;

  constructor(refusal: PublicationRefusal) {
    super(`platform.notification.category_refused.${refusal}`);
  }
}

/** Why a publication would change nothing (task 67.10) — the suffix of each reason's message key. */
export const CATEGORY_UNCHANGED = { UNCHANGED: 'unchanged', NOTHING_TO_REVERT: 'nothing_to_revert' } as const;
export type CategoryUnchangedReason = (typeof CATEGORY_UNCHANGED)[keyof typeof CATEGORY_UNCHANGED];

/** A-17 was asked to publish the behaviour already in force, or to revert with nothing before it (task 67.10). */
export class NotificationCategoryUnchangedError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.Conflict;
  readonly status = 409;

  constructor(reason: CategoryUnchangedReason) {
    super(`platform.notification.category_${reason}`);
  }
}

/** A path naming no category this release raises (task 67.10). */
export class NotificationCategoryNotFoundError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.NotFound;
  readonly status = 404;

  constructor() {
    super('platform.notification.category_not_found');
  }
}
