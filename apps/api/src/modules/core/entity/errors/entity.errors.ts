import { DomainError } from '@api/app/filters/domain.error';
import { ProblemType, type ProblemTypeSlug } from '@api/app/filters/problem-types';

/**
 * Reporting-entity failures, as `DomainError`s carrying message keys (see `account.errors.ts`,
 * whose header this file inherits).
 */

/**
 * No such entity in the active organization.
 *
 * Another tenant's entity id reaches this too, and that is the point: RLS returns no row, so "not
 * yours" and "not there" are one answer rather than two — a distinction would make this route a
 * cross-tenant existence oracle. `MemberNotFoundError`'s reasoning, on the second table to need it.
 */
export class EntityNotFoundError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.NotFound;
  readonly status = 404;

  constructor() {
    super('core.entity.not_found');
  }
}

/**
 * An activity code that the country's classifier does not register (FR-17).
 *
 * `400` and its own slug: the request is well-formed and one value in it is not admissible, and
 * S-13 has to name the way out — pick from the classifier — which a generic validation failure
 * cannot express.
 */
export class NaceCodeUnknownError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.NaceCodeUnknown;
  readonly status = 400;

  constructor() {
    super('core.entity.nace_code_unknown');
  }
}

/**
 * `consolidated` with no subsidiaries inside the boundary (FR-19, UC-54).
 *
 * **A structural contradiction in the record, not a completeness rule about filing** — which is why
 * it is refused here rather than left to task 40's validation engine. FR-19 reads "where
 * consolidated, the subsidiaries inside the reporting boundary": a consolidated basis names a
 * boundary, and an empty boundary names nothing. Every quantitative figure in the report is
 * gathered against it, so the incoherent state is one nothing downstream can interpret.
 *
 * `400`: S-13 saves the basis and the members together, so the caller can always send both.
 */
export class ConsolidationBoundaryEmptyError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.ConsolidationBoundaryEmpty;
  readonly status = 400;

  constructor() {
    super('core.entity.consolidation_boundary_empty');
  }
}

/**
 * The entity is archived, so its master data is no longer editable (FR-20, UC-55).
 *
 * `409` rather than `404`: the entity exists and is readable — its historical reports must stay
 * retrievable — and what refuses the write is its *state*. Nothing about the submitted values is
 * wrong, which is why this is not a validation failure.
 */
export class EntityArchivedError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.EntityArchived;
  readonly status = 409;

  constructor() {
    super('core.entity.archived');
  }
}

/**
 * FR-16's identifier refusals — the reporting entity's since task 175, which moved them from the organization with the
 * identifiers themselves. **Two problem types across three errors**, because a front end
 * branches on the *resolution* and there are two of those — retype a malformed value, or go back
 * to the source for one whose check digits disagree. Which identifier failed is carried by the
 * message, since S-13 knows which fields it submitted and the reader needs the sentence, not a slug.
 */

/** The IDNO is not thirteen digits (Government Decision 272/2002, point 5). */
export class IdnoMalformedError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.IdentifierMalformed;
  readonly status = 400;

  constructor() {
    super('core.entity.idno_malformed');
  }
}

/** The LEI is not twenty characters of the classes ISO 17442 permits. */
export class LeiMalformedError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.IdentifierMalformed;
  readonly status = 400;

  constructor() {
    super('core.entity.lei_malformed');
  }
}

/**
 * The LEI is well-formed and its ISO 7064 MOD 97-10 check digits do not agree with it.
 *
 * **This is the failure the checksum exists to catch and a shape check cannot**: a transposition of
 * two adjacent characters, or a single altered one, leaves the value looking perfectly valid. There
 * is no IDNO counterpart yet — its algorithm is unknown (§7.2), and a guessed one would refuse real
 * registrations rather than catch mistyped ones.
 */
export class LeiCheckDigitsError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.IdentifierCheckDigits;
  readonly status = 400;

  constructor() {
    super('core.entity.lei_check_digits');
  }
}
