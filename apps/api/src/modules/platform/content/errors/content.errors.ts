import { DomainError } from '@api/app/filters/domain.error';
import { ProblemType, type ProblemTypeSlug } from '@api/app/filters/problem-types';

/**
 * No article is in force under that key (task 76; UC-181; FR-61 AC-2). **One answer for an article never published and
 * one not in force** — a draft has no address (`architecture.md` §12.5.6's task-76 row (1)), so the reader is told
 * only that there is nothing here and where to look instead.
 */
export class HelpArticleNotFoundError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.NotFound;
  readonly status = 404;

  constructor() {
    super('platform.content.article_not_found');
  }
}

/**
 * A-03's refusals (task 67.5; FR-61, FR-62; §12.5.6's task-67.5 row) — each names its resolution in its catalogue entry
 * (NFR-79).
 */

/** An item's key that is not lower-case words joined by hyphens, at most 80 characters. */
export class ContentKeyInvalidError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.ValidationFailed;
  readonly status = 400;

  constructor() {
    super('platform.content.key_invalid');
  }
}

/** A payload the item's reader would not read — refused at publication, as every content publication is (task 76). */
export class ContentPayloadRefusedError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.ValidationFailed;
  readonly status = 400;

  constructor() {
    super('platform.content.payload_refused');
  }
}

/** A step that needs a draft in a state the item's draft is not in — none to submit, none in review to publish. */
export class ContentDraftMissingError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.Conflict;
  readonly status = 409;

  constructor() {
    super('platform.content.draft_missing');
  }
}

/** A publication whose sign-off leaves out a locale one of its items carries (NFR-23; 182/37). */
export class ContentSignOffMissingError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.ValidationFailed;
  readonly status = 400;

  constructor() {
    super('platform.content.sign_off_missing');
  }
}

/** A revert of an item with no earlier version to put back. */
export class ContentNothingToRevertError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.Conflict;
  readonly status = 409;

  constructor() {
    super('platform.content.nothing_to_revert');
  }
}

/** A locale registration that does not hold the source locale, or names a locale the build has no catalogue for. */
export class LocaleRegistrationInvalidError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.ValidationFailed;
  readonly status = 400;

  constructor() {
    super('platform.content.locale_registration_invalid');
  }
}

/** A locale registration saved over one a colleague published after this operator read it. */
export class LocaleRegistrationChangedError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.Conflict;
  readonly status = 409;

  constructor() {
    super('platform.content.locale_registration_changed');
  }
}

/** A kind A-03 does not edit (task 67.5) — judged in the controller, since `ParseEnumPipe` reorders the served contract. */
export class ContentKindUnknownError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.NotFound;
  readonly status = 404;

  constructor() {
    super('platform.content.kind_unknown');
  }
}
