import { DomainError } from '@api/app/filters/domain.error';
import { ProblemType, type ProblemTypeSlug } from '@api/app/filters/problem-types';

/**
 * The carbon calculator's refusals (task 38.1), as `DomainError`s carrying message keys — `report.errors.ts`'s shape,
 * whose header this file inherits. A report that is not there is `ReportNotFoundError` and a locked one
 * `ReportNotEditableError`, both `core/disclosure`'s: one report, one way of saying either.
 */

/**
 * A line names an energy source the report's factor set does not cover.
 *
 * **400, not 404**, `UnknownDisclosureElementError`'s reasoning: the report is there, and what was sent does not belong
 * to its factors — most likely a screen loaded before a correction to the set was published.
 */
export class UnknownCalcSourceError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.ValidationFailed;
  readonly status = 400;

  constructor() {
    super('core.calculator.unknown_source');
  }
}

/** A line's figure is in a unit its source cannot be entered in (UX-14: a constrained list, never free text). */
export class CalcUnitNotAdmittedError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.ValidationFailed;
  readonly status = 400;

  constructor() {
    super('core.calculator.unit_not_admitted');
  }
}

/**
 * A line names a site the report's B1 does not list (§12.5.6's task-38.1 row): the calculator sums over the sites the
 * report discloses, so a line at any other is a figure outside the report's own boundary.
 */
export class UnknownCalcSiteError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.ValidationFailed;
  readonly status = 400;

  constructor() {
    super('core.calculator.unknown_site');
  }
}

/** A line is neither a figure with its unit nor a reason the figure is unavailable — or claims both. */
export class CalcSourceContentsError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.ValidationFailed;
  readonly status = 400;

  constructor() {
    super('core.calculator.contents_invalid');
  }
}

/**
 * The id a client chose for a line already names a line of **another** of the organization's reports. A line never
 * moves between reports; under the generic conflict, since it is a client defect rather than a state a screen offers.
 */
export class CalcSourceElsewhereError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.Conflict;
  readonly status = 409;

  constructor() {
    super('core.calculator.source_elsewhere');
  }
}

/**
 * No factor set serves the report's period (task 37.2) — none published for it yet, or the published one unreadable.
 * **A refusal to guess**: a line checked against no set, or a run pinned to none, would be a figure with no basis.
 */
export class NoFactorSetError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.Conflict;
  readonly status = 409;

  constructor() {
    super('core.calculator.no_factor_set');
  }
}

/**
 * A run was asked for a report holding no invoice lines. **Refused rather than recorded as zero**: S-09's artboard
 * says it plainly — *"zero is an answer someone might file"*.
 */
export class NoCalcSourcesError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.Conflict;
  readonly status = 409;

  constructor() {
    super('core.calculator.no_sources');
  }
}
