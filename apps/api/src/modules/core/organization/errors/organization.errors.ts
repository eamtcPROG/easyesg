import { DomainError } from '@api/app/filters/domain.error';
import { ProblemType, type ProblemTypeSlug } from '@api/app/filters/problem-types';

/**
 * Organization failures, as `DomainError`s carrying message keys (see `account.errors.ts`, whose
 * header this file inherits).
 *
 * **The country refusal is a `400` of its own, not a `ValidationFailed`**: its resolution — *the platform does not
 * operate in that country yet, and no edit to this form will change that* — is not one a front end can derive from a
 * generic slug. Its sibling, the legal-form refusal, is the entity's since task 177 (`entity.errors.ts`).
 *
 * Neither discloses anything a caller could not read from the vocabulary endpoint, which is
 * unauthenticated configuration about what the platform offers rather than about any tenant.
 */

/**
 * §7.2's stated consequence of scoping legal forms by country: an organization cannot be created
 * where no vocabulary is registered, because it could never hold a legal form afterwards.
 *
 * **Refused at creation rather than at the first profile save**, which is the choice worth stating.
 * Permitting the organization and refusing the form later would leave a real tenant, with real
 * members and real reports, permanently unable to complete the B1 disclosure its export needs —
 * discovered at filing time, which is the moment FR-16 uses to argue for validating early.
 */
export class CountryNotSupportedError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.CountryNotSupported;
  readonly status = 400;

  constructor() {
    super('core.organization.country_not_supported');
  }
}

/**
 * The bound organization's row is not readable.
 *
 * In practice unreachable: `@RequiresRole` has already refused a caller with no membership in an
 * active organization, so reaching this means the row was removed between the membership lookup and
 * the read. It exists so that case answers a described 404 rather than a null dereference.
 */
export class OrganizationNotFoundError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.NotFound;
  readonly status = 404;

  constructor() {
    super('core.organization.not_found');
  }
}

/**
 * The tenant read matched more than one organization.
 *
 * **Unreachable today, and that is the reason to raise rather than to choose.** `core.organization`
 * carries three permissive `SELECT` policies, OR'd; only one can match inside a request transaction
 * because the other two are gated on settings nothing binds there. The day a flow binds
 * `app.current_invitation` on the request transaction — a signed-in user previewing an invitation
 * — the read would return two rows, and picking the first would disclose another tenant's profile
 * while RLS did exactly what it was told.
 *
 * `500`, because no caller can act on it: the request was well-formed, the actor was entitled, and
 * what failed is an invariant of ours. It carries no message key for the same reason `TenantContextMissingError`
 * carries none — the reader is an operator reading a log, not a person reading a screen.
 */
export class AmbiguousBoundOrganizationError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.Internal;
  readonly status = 500;

  constructor(matched: number) {
    super(
      `A tenant read on core.organization matched ${matched} rows where at most one is possible. ` +
        'Some policy or binding now admits a second organization to a bound request.',
    );
  }
}
