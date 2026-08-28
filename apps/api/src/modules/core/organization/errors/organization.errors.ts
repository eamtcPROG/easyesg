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

/**
 * FR-16's identifier refusals. **Two problem types across three errors**, because a front end
 * branches on the *resolution* and there are two of those — retype a malformed value, or go back
 * to the source for one whose check digits disagree. Which identifier failed is carried by the
 * message, since S-15 knows which fields it submitted and the reader needs the sentence, not a slug.
 */

/** The IDNO is not thirteen digits (Government Decision 272/2002, point 5). */
export class IdnoMalformedError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.IdentifierMalformed;
  readonly status = 400;

  constructor() {
    super('core.organization.idno_malformed');
  }
}

/** The LEI is not twenty characters of the classes ISO 17442 permits. */
export class LeiMalformedError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.IdentifierMalformed;
  readonly status = 400;

  constructor() {
    super('core.organization.lei_malformed');
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
    super('core.organization.lei_check_digits');
  }
}
