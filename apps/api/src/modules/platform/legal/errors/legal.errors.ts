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
