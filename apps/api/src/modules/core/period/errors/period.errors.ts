import { DomainError } from '@api/app/filters/domain.error';
import { ProblemType, type ProblemTypeSlug } from '@api/app/filters/problem-types';

/**
 * Reporting-period failures, as `DomainError`s carrying message keys (see `account.errors.ts`,
 * whose header this file inherits).
 */

/**
 * No such period in the active organization.
 *
 * Another tenant's period id reaches this too, and that is the point: RLS returns no row, so "not
 * yours" and "not there" are one answer rather than two — `EntityNotFoundError`'s reasoning, on the
 * next table to need it.
 */
export class PeriodNotFoundError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.NotFound;
  readonly status = 404;

  constructor() {
    super('core.period.not_found');
  }
}

/**
 * UC-56 refused: another period for the same entity already covers part of these dates.
 *
 * **Raised from the database's own exclusion constraint, not from a read-then-write check.** A
 * `SELECT` for a conflicting period followed by an `INSERT` is a race two administrators opening
 * adjacent years can lose; the constraint cannot be. The repository translates it here so the
 * refusal is a domain answer rather than a driver error.
 */
export class PeriodOverlapsError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.PeriodOverlaps;
  readonly status = 409;

  constructor() {
    super('core.period.overlaps');
  }
}

/**
 * The period's own dates do not describe a period — the end falls before the start, a boundary is
 * not a real calendar day, or a zone is not one IANA carries.
 *
 * One error for the three because they share a resolution — correct the dates — and S-14 renders
 * the same guidance for each. `ValidationFailed` rather than a slug of its own for the same reason:
 * nothing branches on it.
 */
export class PeriodDatesInvalidError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.ValidationFailed;
  readonly status = 400;

  constructor() {
    super('core.period.dates_invalid');
  }
}

/**
 * UC-56's precondition unmet: no taxonomy version is registered, so there is nothing to pin.
 *
 * **Refused rather than defaulted.** FR-66 requires an explicit version on every report and DR-4
 * makes it a dimension of the data model; opening a period with a version invented here — the
 * newest registered, a constant, an empty string — would produce a report whose meaning nobody can
 * reconstruct. It is the one refusal on this route the caller cannot resolve themselves, which is
 * what its own slug is for.
 */
export class TaxonomyVersionUnavailableError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.TaxonomyVersionUnavailable;
  readonly status = 409;

  constructor() {
    super('core.period.taxonomy_version_unavailable');
  }
}
