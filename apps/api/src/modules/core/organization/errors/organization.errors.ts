import { DomainError } from '@api/app/filters/domain.error';
import { ProblemType, type ProblemTypeSlug } from '@api/app/filters/problem-types';

/**
 * Organization failures, as `DomainError`s carrying message keys (see `account.errors.ts`, whose
 * header this file inherits).
 *
 * **Both value refusals are `400`, and neither is a `ValidationFailed`.** The generic slug would
 * tell S-04 and S-15 that *something* in the body was wrong, and the two states below have
 * different resolutions that a front end cannot derive from wording: one is *pick another form
 * from the list*, the other is *the platform does not operate in that country yet, and no edit to
 * this form will change that*. This is `last-administrator`'s argument applied to a second pair.
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
 * The submitted legal form is not in the vocabulary registered for the organization's country
 * (FR-15, AD-4).
 *
 * **Reached by changing the country as well as by changing the form**, which is why the check is
 * against the patch's resulting country rather than the stored one: moving an organization from
 * `MD` to a country whose vocabulary does not carry its current form would otherwise leave a
 * stored value no list contains.
 */
export class LegalFormUnknownError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.LegalFormUnknown;
  readonly status = 400;

  constructor() {
    super('core.organization.legal_form_unknown');
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
