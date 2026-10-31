import { DomainError } from '@api/app/filters/domain.error';
import { ProblemType, type ProblemTypeSlug } from '@api/app/filters/problem-types';

/**
 * No readable support address is in force (task 77; §12.5.6's task-77 row (5)). **Nothing was recorded**: a request
 * nobody is told of is worse than one the reader is asked to send again, so the reader is told to wait, as
 * `legal-controller-unavailable`'s reader is.
 */
export class SupportChannelUnavailableError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.SupportChannelUnavailable;
  readonly status = 503;

  constructor() {
    super('platform.support.channel_unavailable');
  }
}

/** A sixth request from one sender within fifteen minutes (row (6)). Nothing was recorded. */
export class SupportRequestThrottledError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.RateLimited;
  readonly status = 429;

  constructor() {
    super('platform.support.throttled');
  }
}

/**
 * A request with no session that gives no name or no address (row (3)). A signed-in reader is never asked, so this is a
 * visitor's alone — a check the DTO cannot make, since only the guard knows whether a session came.
 */
export class SupportSenderRequiredError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.ValidationFailed;
  readonly status = 400;

  constructor() {
    super('platform.support.sender_required');
  }
}
