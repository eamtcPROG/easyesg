import { DomainError } from '@api/app/filters/domain.error';
import { ProblemType, type ProblemTypeSlug } from '@api/app/filters/problem-types';

/**
 * A-19's refusals (task 144; UC-212), each naming its resolution in the catalogue entry its key points at.
 *
 * **403 and 409, never 401**, because the operator is signed in: a 401 is the console's *sign in again*,
 * and a mistyped password on a settings screen must not read as a session that ended.
 */

/** The current password is not right — every A-19 write asks for it. The tenant `ReauthenticationFailedError`'s type and status. */
export class AdminReauthenticationFailedError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.CredentialInvalid;
  readonly status = 403;

  constructor() {
    super('platform.admin.reauthentication_failed');
  }
}

/** A confirmation with nothing staged — a re-enrolment never begun, or one already confirmed. */
export class AdminReenrolmentMissingError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.Conflict;
  readonly status = 409;

  constructor() {
    super('platform.admin.reenrolment_missing');
  }
}

/** The confirming code is not current for the staged secret; the factor in force is untouched. */
export class AdminReenrolmentCodeInvalidError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.FactorInvalid;
  readonly status = 403;

  constructor() {
    super('platform.admin.reenrolment_code_invalid');
  }
}
