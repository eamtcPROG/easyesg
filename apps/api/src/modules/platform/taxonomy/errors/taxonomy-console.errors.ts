import { DomainError } from '@api/app/filters/domain.error';
import { ProblemType, type ProblemTypeSlug } from '@api/app/filters/problem-types';

/** A-04's refusals (tasks 67.21, 67.6) — each names its resolution in its catalogue entry (NFR-79). */

/** No committed candidate holds that version — nothing in the release to register. */
export class TaxonomyCandidateNotFoundError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.NotFound;
  readonly status = 404;

  constructor() {
    super('platform.taxonomy.candidate_not_found');
  }
}

/** A pair, a mapping or an adoption naming a version the store does not register, or a template that is not its. */
export class TaxonomyVersionUnknownError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.NotFound;
  readonly status = 404;

  constructor() {
    super('platform.taxonomy.version_unknown');
  }
}

/** A mapping the registry would not read, naming an element its versions do not hold, or a determination its fields refuse. */
export class TaxonomyMappingInvalidError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.ValidationFailed;
  readonly status = 400;

  constructor() {
    super('platform.taxonomy.mapping_invalid');
  }
}

/** An adoption on a day that does not fall after the open window's start, or after today. */
export class TaxonomyAdoptionInvalidError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.ValidationFailed;
  readonly status = 400;

  constructor() {
    super('platform.taxonomy.adoption_invalid');
  }
}

/** A mapping or an adoption saved over one a colleague published after this operator read it. */
export class TaxonomyChangedError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.Conflict;
  readonly status = 409;

  constructor() {
    super('platform.taxonomy.changed');
  }
}

/** A candidate whose artefacts the store refuses — a taxonomy the registry would not read, a map naming a cell it may not write. */
export class TaxonomyCandidateRefusedError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.ValidationFailed;
  readonly status = 400;

  constructor() {
    super('platform.taxonomy.candidate_refused');
  }
}

/** A run between two versions whose mapping nobody has published — the determination it would move reports by is unknown. */
export class MigrationMappingMissingError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.Conflict;
  readonly status = 409;

  constructor() {
    super('platform.taxonomy.migration_mapping_missing');
  }
}

/** A run that would select no report — none on the version, or every one read-only. */
export class MigrationRunEmptyError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.Conflict;
  readonly status = 409;

  constructor() {
    super('platform.taxonomy.migration_run_empty');
  }
}

/** No run by that id. */
export class MigrationRunNotFoundError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.NotFound;
  readonly status = 404;

  constructor() {
    super('platform.taxonomy.migration_run_not_found');
  }
}

/** A retry of a run with nothing failed, or a retry or revert of one already reverted. */
export class MigrationRunSettledError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.Conflict;
  readonly status = 409;

  constructor() {
    super('platform.taxonomy.migration_run_settled');
  }
}
