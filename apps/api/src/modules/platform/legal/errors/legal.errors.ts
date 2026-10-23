import { DomainError } from '@api/app/filters/domain.error';
import { ProblemType, type ProblemTypeSlug } from '@api/app/filters/problem-types';

/**
 * No readable controller is in force — the artefact absent, or holding a payload the reader refuses (task 75;
 * §12.5.6's task-75 row (7)). A configuration fault the platform corrects, so the way out is to wait, as
 * `seat-allowance-unavailable`'s is; the terms of service and the privacy notice answer *not yet available* meanwhile.
 */
export class LegalControllerUnavailableError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.LegalControllerUnavailable;
  readonly status = 503;

  constructor() {
    super('platform.legal.controller_unavailable');
  }
}

/**
 * An answer to the cookie banner named a cookie policy version that is not the one in force (task 223; §12.5.6's
 * task-223 row (2)) — the banner was read before a release replaced the policy. `legal-version-changed`, task 195's type
 * for the same conflict over the terms, with wording of its own: the web shows the banner again, and nothing was saved.
 */
export class CookiePolicyVersionChangedError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.LegalVersionChanged;
  readonly status = 409;

  constructor() {
    super('platform.legal.cookie_policy_changed');
  }
}
