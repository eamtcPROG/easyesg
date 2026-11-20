import { DomainError } from '@api/app/filters/domain.error';
import { ProblemType, type ProblemTypeSlug } from '@api/app/filters/problem-types';

/** A-05's refusals (task 67.8) — each names its resolution in its catalogue entry (NFR-79). */

/** A payload the family's reader would not read — refused before anything is written (182/50, 182/51). */
export class RulesPayloadRefusedError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.ValidationFailed;
  readonly status = 400;

  constructor() {
    super('platform.rules.payload_refused');
  }
}

/** A slot a colleague published after this operator read it. */
export class RulesChangedError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.Conflict;
  readonly status = 409;

  constructor() {
    super('platform.rules.changed');
  }
}

/** A family A-05 does not publish. */
export class RulesFamilyUnknownError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.NotFound;
  readonly status = 404;

  constructor() {
    super('platform.rules.family_unknown');
  }
}
