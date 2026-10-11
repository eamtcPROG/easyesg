import { DomainError } from '@api/app/filters/domain.error';
import { ProblemType, type ProblemTypeSlug } from '@api/app/filters/problem-types';

/** What a 404 on an export route says in the contract. */
export const NO_SUCH_EXPORT = 'No such export in the active organization.';

/** An export that is not one of the bound organization's — never distinguished from one that does not exist (task 47.1). */
export class ExportNotFoundError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.NotFound;
  readonly status = 404;

  constructor() {
    super('core.export.not_found');
  }
}

/**
 * The file of an export still being produced, or of one that failed, was asked for (task 47.1; FR-53). Its own type, for
 * a client that polls: the way out is to wait, or to export again.
 */
export class ExportFileUnavailableError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.ExportFileUnavailable;
  readonly status = 409;

  constructor() {
    super('core.export.file_unavailable');
  }
}

/**
 * FR-44's refusal (task 47.4; 182/20): an export of a report with unresolved findings, asked for without acknowledging
 * them. **The document lists the findings as this request evaluated them** — `findings`, each as S-08's read names it —
 * so the warning a client draws is the list the api judged, and an acknowledged request then exports. Nothing is
 * refused for good: the same request with the acknowledgement is accepted.
 */
export class ExportFindingsUnacknowledgedError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.ExportFindingsUnacknowledged;
  readonly status = 409;

  constructor(findings: readonly unknown[]) {
    super('core.export.findings_unacknowledged', { count: findings.length }, { findings });
  }
}
