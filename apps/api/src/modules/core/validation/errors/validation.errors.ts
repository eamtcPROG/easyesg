import { DomainError } from '@api/app/filters/domain.error';
import { ProblemType, type ProblemTypeSlug } from '@api/app/filters/problem-types';

/**
 * Validation's refusals (task 41), as `DomainError`s carrying message keys — `report.errors.ts`'s shape. A report that
 * is not there is `ReportNotFoundError`, `core/disclosure`'s: one report, one way of saying so.
 */

/**
 * No validation rule set can be read — none is in force on the day, or the one in force, or the one a lock pinned,
 * does not read (task 41.1; §12.5.6's task-41 row (d)).
 *
 * **503 and refused, never an evaluation against nothing**: a run with no rules finds nothing, and nothing outstanding
 * reads ready to file. A lock is refused the same way, since a lock pins the set in force (row (5)) and a lock with no
 * pin would leave its report's findings free to move. `seat-allowance-unavailable`'s shape: a configuration fault the
 * platform corrects, and nothing was changed.
 */
export class ValidationRulesUnavailableError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.ValidationRulesUnavailable;
  readonly status = 503;

  constructor() {
    super('core.validation.rules_unavailable');
  }
}
