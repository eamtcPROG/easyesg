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
/**
 * What a `404` from any report route means, as its OpenAPI surface states it.
 *
 * **Beside the error rather than in a controller**, because three controllers now publish it —
 * `ReportsController`, `ComparativesController` and `WizardController` — and the sentence is a
 * consequence of `ReportNotFoundError`'s own reasoning: RLS makes "not yours" and "not there" one
 * answer, so every route over a report says the same thing and must keep saying it.
 */
export const NO_SUCH_REPORT = 'No such report in the active organization.';

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

/**
 * The report pins a taxonomy version the registry no longer carries.
 *
 * **An explicit failure rather than an empty form**, which is the position `TAXONOMY_REGISTRY`'s own
 * header takes for `taxonomy()`: *"`null` when that version is not registered, which is how a report
 * pinned to a withdrawn version surfaces as an explicit failure rather than as an empty form"*. A
 * wizard rendering no questions would look like a report that asks none, and a reporter would spend
 * an afternoon on it before anyone learned the pin was the problem.
 *
 * **Distinct from `core.period.taxonomy_version_unavailable` even though the slug is shared**, for
 * the reason `ReportNotEditableError` is distinct from `PeriodLockedError`: that one answers *no
 * version is registered at all, so a period cannot be opened*, and this one answers *this report's
 * own version has gone*. The ways out differ — the first blocks new work, the second leaves saved
 * answers intact, and the message says so.
 *
 * **500 rather than 404.** Nothing the caller sent is wrong; the platform is holding a report it can
 * no longer describe. Answering 404 would tell a reporter their report is missing when it is not.
 */
export class TaxonomyVersionUnavailableError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.TaxonomyVersionUnavailable;
  readonly status = 500;

  constructor() {
    super('core.report.taxonomy_version_unavailable');
  }
}

/**
 * A value was offered for an element the report's pinned taxonomy does not name.
 *
 * **A refusal rather than a silent write**, because the row would be invisible afterwards: every read
 * in this module walks the taxonomy and would never ask for a key it does not contain. That is task
 * 34.2's *"a live row under a key nothing reads"* one layer down, and the reason its typed facade
 * exists at all.
 *
 * **400, not 404.** The report is there; what the caller sent does not belong to it — most likely a
 * stale wizard against a report pinned to a different version (DR-4), which is a client to refresh
 * rather than a resource that is missing.
 */
export class UnknownDisclosureElementError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.ValidationFailed;
  readonly status = 400;

  constructor() {
    super('core.report.unknown_disclosure_element');
  }
}
