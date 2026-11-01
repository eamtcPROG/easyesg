import { DomainError } from '@api/app/filters/domain.error';
import { ProblemType, type ProblemTypeSlug } from '@api/app/filters/problem-types';

/**
 * An account's setup refusals (task 155; §12.5.6's task-155 row, S-36), as `DomainError`s carrying
 * message keys — `account.errors.ts` holds the argument for both halves of that.
 *
 * **Every one of them is disclosed only to a caller holding the account's session or its single-use
 * grant**, so none is an enumeration surface: they say what the holder of the account already knows
 * about it, and each names the way on.
 */

/** The first password's proof: the provider sign-in behind this session is fifteen minutes old or more. */
export class SetupSessionStaleError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.AccountSetupProofStale;
  readonly status = 403;

  constructor() {
    super('identity.setup.session_stale');
  }
}

/**
 * The link path's proof: the grant is unknown, spent, past its quarter-hour, or its account has passed
 * its setup deadline. Collapsed for `ResetTokenInvalidError`'s reason — on a public route, the
 * distinctions describe the token to whoever holds a guess at one, and the way on is the same.
 */
export class SetupGrantInvalidError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.AccountSetupProofStale;
  readonly status = 403;

  constructor() {
    super('identity.setup.grant_invalid');
  }
}

/** A setup write for an account that is not in setup — it is active, and there is nothing to complete. */
export class AccountSetupNotPendingError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.Conflict;
  readonly status = 409;

  constructor() {
    super('identity.setup.not_pending');
  }
}

/**
 * A first password for an account that already holds one — set earlier on S-36, or by a reset link.
 * Refused rather than replaced: replacing a held password without the current one is what FR-7 forbids.
 */
export class FirstPasswordAlreadySetError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.Conflict;
  readonly status = 409;

  constructor() {
    super('identity.setup.password_already_set');
  }
}

/**
 * A name part that is only whitespace. The DTO bounds the length; a part with no visible character
 * passes that and is not a name (`display-name.ts`), so the use case refuses it with NFR-79's message.
 */
export class SetupNamesRequiredError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.ValidationFailed;
  readonly status = 400;

  constructor() {
    super('identity.setup.names_required');
  }
}
