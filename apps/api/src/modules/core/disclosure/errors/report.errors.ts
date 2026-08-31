import { DomainError } from '@api/app/filters/domain.error';
import { ProblemType, type ProblemTypeSlug } from '@api/app/filters/problem-types';

/**
 * Report failures, as `DomainError`s carrying message keys (see `account.errors.ts`, whose header
 * this file inherits).
 */

/**
 * No such report in the active organization.
 *
 * Another tenant's report id reaches this too, and that is the point: RLS returns no row, so "not
 * yours" and "not there" are one answer rather than two — `PeriodNotFoundError`'s reasoning, on the
 * next table to need it.
 */
export class ReportNotFoundError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.NotFound;
  readonly status = 404;

  constructor() {
    super('core.report.not_found');
  }
}

/**
 * The period already has a report, and a period has at most one.
 *
 * **Its own slug rather than the generic conflict**, for `last-administrator`'s reason: S-06 has to
 * name the specific way out, which here is *open the report that already exists* rather than
 * *change what you submitted*. A front end cannot branch on wording.
 *
 * Raised from the database's own unique constraint, not from a read-then-write check — two
 * Contributors opening the same period's report at once lose that race, and the constraint cannot.
 */
export class ReportAlreadyExistsError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.ReportAlreadyExists;
  readonly status = 409;

  constructor() {
    super('core.report.already_exists');
  }
}

/**
 * FR-22 and FR-26: the report takes no writes, because its period is locked.
 *
 * **Distinct from `PeriodLockedError` even though the cause is one lock**, because the two are
 * raised on different surfaces and name different ways out: that one answers a write to the period
 * shell, this one answers a write to the report inside it. `ReportNotEditable` was already in the
 * problem vocabulary awaiting exactly this — FR-26 grants an editable session only where the period
 * is open, and this is that refusal.
 *
 * **Not a role refusal.** The lock refuses every write including the administrator's (§12.5.6's
 * task-31.2 row), so the message names reopening rather than telling the caller they lack
 * permission, which would be false.
 *
 * Raised by the use case from the row it has already read, **and** translated from SQLSTATE `45001`
 * when the database's own trigger refuses first. The second path is not redundant: it is what a
 * caller meets when the period was locked between the read and the write.
 */
export class ReportNotEditableError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.ReportNotEditable;
  readonly status = 409;

  constructor() {
    super('core.report.not_editable');
  }
}
