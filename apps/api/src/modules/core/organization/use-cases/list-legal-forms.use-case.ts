import type { OrganizationVocabulary } from '../interfaces/organization-vocabulary.interface';

/** One country the platform operates in, and the legal forms registered for it. */
export interface CountryLegalForms {
  readonly countryCode: string;
  readonly legalForms: readonly string[];
}

/**
 * The vocabulary S-04 and S-15 render their selects from (FR-15, AD-4).
 *
 * **Two screens, one answer, and that is why it is a list rather than a lookup by country.** S-15
 * needs the forms for an organization that already has a country; S-04 needs the *countries*,
 * because §7.2 makes creation refuse a country registering no vocabulary — and a founding screen
 * that offers all 249 ISO codes to a rule admitting one is a form designed to be failed. Returning
 * the registered pairs answers both from one request, and it is a list of one at MVP.
 *
 * **Not a hardcoded country list in the front end**, which is the alternative this exists to avoid:
 * enabling a second country is then one configuration entry, propagating in ≤5 s, rather than an
 * entry plus a release of two applications.
 */
export class ListLegalForms {
  constructor(private readonly vocabulary: OrganizationVocabulary) {}

  execute(): CountryLegalForms[] {
    return this.vocabulary.registeredLegalForms().map((entry) => ({
      // The scope is lower case because a seed filename is; ISO renders alpha-2 upper case, and the
      // wire follows ISO. This is the one place that conversion happens.
      countryCode: entry.countryCode.toUpperCase(),
      legalForms: entry.legalForms,
    }));
  }
}
