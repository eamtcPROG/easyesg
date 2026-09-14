import { DomainError } from '@api/app/filters/domain.error';
import { ProblemType, type ProblemTypeSlug } from '@api/app/filters/problem-types';
import { ADMIN_ACCOUNT_CHANGE, type AdminAccountChange } from '../models/admin-account-change.model';

/**
 * A-08's refusals about accounts (task 67.4; FR-80) — each names its resolution, per NFR-79, in the
 * catalogue entry its key points at.
 */

/** No such account — or none this realm holds; an id is not a question about another table. */
export class AdminAccountNotFoundError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.NotFound;
  readonly status = 404;

  constructor() {
    super('platform.admin.account_not_found');
  }
}

/**
 * An account that is not removed already holds the address — at issue, or at an acceptance the
 * provisioning CLI raced. A removed account's address is free: inviting it creates a new account.
 */
export class AdminAccountExistsError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.AdminAccountExists;
  readonly status = 409;

  constructor() {
    super('platform.admin.account_exists');
  }
}

/**
 * An operator acting on their own account. Suspending or removing yourself is a lockout nobody asked
 * for, and the screen does not offer it; this is the server's copy of that rule, not a second copy of
 * a client check.
 */
export class AdminAccountSelfError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.Conflict;
  readonly status = 409;

  constructor() {
    super('platform.admin.account_self');
  }
}

/** FR-60's rule over the realm: the last active Platform Administrator stays. */
export class LastPlatformAdministratorError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.LastAdministrator;
  readonly status = 409;

  constructor() {
    super('platform.admin.last_platform_administrator');
  }
}

/**
 * The account is not in a status the change applies from — suspending a suspended account,
 * reactivating an active one, anything on a removed one. **One key per change**, because the true
 * sentence differs: *already suspended* is not *not suspended*. Declared as a literal map so every key
 * is greppable, the tenant invitation standing's key shape.
 */
const CHANGE_REFUSED_KEY = {
  [ADMIN_ACCOUNT_CHANGE.SUSPEND]: 'platform.admin.account_change.suspend',
  [ADMIN_ACCOUNT_CHANGE.REACTIVATE]: 'platform.admin.account_change.reactivate',
  [ADMIN_ACCOUNT_CHANGE.REMOVE]: 'platform.admin.account_change.remove',
} as const satisfies Record<AdminAccountChange, string>;

export class AdminAccountChangeRefusedError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.Conflict;
  readonly status = 409;

  constructor(change: AdminAccountChange) {
    super(CHANGE_REFUSED_KEY[change], undefined, { change });
  }
}

/** A lockout release on an account that is not locked — refused rather than logged as a change. */
export class AdminAccountNotLockedError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.Conflict;
  readonly status = 409;

  constructor() {
    super('platform.admin.account_not_locked');
  }
}
