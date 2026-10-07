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
 * A line's month figures are not S-09's monthly form (task 39.1; §12.5.6's task-39 row (1)): not twelve, one not a
 * number, none entered, sent beside a quantity or a reason — or the report's period does not span twelve calendar
 * months, so there is no form for them to be. A client defect or a screen loaded before the period's dates moved;
 * either way the line is refused whole rather than stored with a quantity nobody typed.
 */
export class CalcMonthsInvalidError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.ValidationFailed;
  readonly status = 400;

  constructor() {
    super('core.calculator.months_invalid');
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

/** What a `404` from the run read means, as its OpenAPI surface states it — `NO_SUCH_REPORT`'s pattern. */
export const NO_SUCH_RUN = 'No such run of this report in the active organization.';

/**
 * No such run of this report (task 38.4). Another tenant's run, or another report's, reaches this too — RLS and the
 * report in the path make "not yours" and "not there" one answer, `ReportNotFoundError`'s reasoning.
 */
export class CalcRunNotFoundError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.NotFound;
  readonly status = 404;

  constructor() {
    super('core.calculator.run_not_found');
  }
}

/**
 * A replacement figure — a line's or a B3 scope's — that is not tonnes written as a number, carries no reason, or
 * replaces a line with no computed figure (task 38.4; UC-34). UX-43: an unexplained substituted figure is never
 * presentable, so the reason is part of what makes the figure acceptable at all.
 */
export class CalcOverrideInvalidError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.ValidationFailed;
  readonly status = 400;

  constructor() {
    super('core.calculator.override_invalid');
  }
}

/** A figure route named an element the calculator does not produce — only B3's Scope 1 and Scope 2 (task 38.4). */
export class UnknownCalcFigureError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.ValidationFailed;
  readonly status = 400;

  constructor() {
    super('core.calculator.unknown_figure');
  }
}
