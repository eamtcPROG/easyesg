import { DomainError } from '@api/app/filters/domain.error';
import { ProblemType, type ProblemTypeSlug } from '@api/app/filters/problem-types';

/**
 * The admin realm's refusals, as `DomainError`s carrying message keys (see
 * `identity/session/errors/session.errors.ts`, whose uniformity argument this file inherits).
 *
 * The disclosure ladder has one more rung than the tenant realm's: `AdminFactorInvalidError` is
 * disclosed only to a caller who presented the CORRECT password for an existing, active, unlocked
 * account — A-01's "failed factor" state (design_spec §5.2) — so it breaches no NFR-64
 * uniformity: whoever sees it already knows the password is right, and the §12.5.6 throttle and
 * lockout bound what that knowledge is worth.
 */

/** The uniform refusal: unknown address, deactivated account, wrong password — one document. */
export class AdminCredentialInvalidError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.CredentialInvalid;
  readonly status = 401;

  constructor() {
    super('platform.admin.credential_invalid');
  }
}

/** Correct password, wrong or malformed TOTP code (FR-75). Counts toward the lockout. */
export class AdminFactorInvalidError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.FactorInvalid;
  readonly status = 401;

  constructor() {
    super('platform.admin.factor_invalid');
  }
}

/**
 * A recovery sign-in refused (task 144) — an unknown or inactive address, a wrong or spent code, or a wrong
 * password, **one document for all of them** (NFR-64). Its own key rather than `credential_invalid`'s,
 * because the true sentence names the code as well; the same type and status, because it is the same kind
 * of refusal.
 */
export class AdminRecoveryRefusedError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.CredentialInvalid;
  readonly status = 401;

  constructor() {
    super('platform.admin.recovery_refused');
  }
}

/**
 * Ten consecutive failures (§12.5.6) — its own slug rather than the tenant `account-locked`,
 * because the catalogue's "what now" differs: the tenant answer is the reset link, and this
 * realm has none. Release is a PA action on A-08 (task 67.4), a recovery sign-in (task 144) or the
 * provisioning CLI.
 */
export class AdminAccountLockedError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.AdminAccountLocked;
  readonly status = 403;

  constructor() {
    super('platform.admin.account_locked');
  }
}

/** Every way a presented cookie can be dead short of expiry, collapsed — reuse revocation
 *  included, which must not announce itself to the thief who tripped it. */
export class AdminSessionInvalidError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.AuthenticationRequired;
  readonly status = 401;

  constructor() {
    super('platform.admin.session_invalid');
  }
}

/** The §12.5.6 clocks ran out — distinct from invalid because the console's answer is "sign in
 *  again", not "something is wrong with your session". */
export class AdminSessionExpiredError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.SessionExpired;
  readonly status = 401;

  constructor() {
    super('platform.admin.session_expired');
  }
}

/**
 * A live operator session whose role the route does not name (task 67.3) — a Billing Operator at the
 * organization register. The tenant refusal's slug, `insufficient-role`, because the slug says what
 * happened and a client reads it the same way in either realm; its own message key, because the
 * *what now* differs — the tenant answer names an organization's administrator, this one a
 * platform administrator.
 */
export class AdminInsufficientRoleError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.InsufficientRole;
  readonly status = 403;

  constructor() {
    super('platform.admin.insufficient_role');
  }
}
