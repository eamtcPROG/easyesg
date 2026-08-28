import { Injectable, Logger } from '@nestjs/common';
import { ConfigurationStore } from '@api/infrastructure/configuration/configuration-store.service';
import {
  ORGANIZATION_LEGAL_FORM_CONFIG_KIND,
  ORGANIZATION_RELATIONSHIP_TYPE_CONFIG_KIND,
  ORGANIZATION_RELATIONSHIP_TYPE_CONFIG_SCOPE,
} from '../constants/organization.constants';
import type { OrganizationVocabulary } from '../interfaces/organization-vocabulary.interface';

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string');

/**
 * `OrganizationVocabulary` over the configuration store — the adapter half of AD-4 for FR-14's
 * organization types and FR-15's legal forms.
 *
 * **Validated, never cast**, following `SocialProviderCatalogService`: configuration is data a
 * person edits through A-18, so a malformed payload must surface as "no vocabulary registered" plus
 * an operator-facing log line. Cast instead, a payload of `{"forms": "srl"}` would spread into
 * seven single-character forms and admit `s` as a legal form — a wrong answer that looks like a
 * working one.
 *
 * **A malformed payload fails closed, and that is not the same choice as the provider catalogue's.**
 * There, an unavailable provider removes one sign-in button and the others still work. Here, a
 * legal-form vocabulary that read as empty would refuse every profile save for that country — so
 * the two behave alike (return nothing, log loudly) but for opposite reasons, and the noisy log is
 * doing more work in this one.
 */
@Injectable()
export class OrganizationVocabularyService implements OrganizationVocabulary {
  private readonly logger = new Logger(OrganizationVocabularyService.name);

  constructor(private readonly configurationStore: ConfigurationStore) {}

  legalFormsFor(countryCode: string): readonly string[] | null {
    // Lower case, because the scope is the seed file's own segment and `organization-legal-form.
    // MD.json` is not a filename anybody writes. The column holds the code upper case (ISO's own
    // rendering), so exactly one of the two has to convert and this is the boundary where it does.
    const entry = this.configurationStore.get(
      ORGANIZATION_LEGAL_FORM_CONFIG_KIND,
      countryCode.toLowerCase(),
    );
    if (!entry) return null;

    const forms = entry.payload.forms;
    if (!isStringArray(forms)) {
      this.logger.error(
        `Configuration entry ${ORGANIZATION_LEGAL_FORM_CONFIG_KIND}/${countryCode.toLowerCase()} ` +
          `(revision ${entry.revision}) is malformed; treating the country as unsupported`,
      );
      return null;
    }
    return forms;
  }

  registeredCountries(): readonly string[] {
    // A malformed payload is excluded rather than logged again: `legalFormsFor` is what every
    // caller then asks, and it logs the entry once with its revision. Listing a country whose
    // vocabulary cannot be read would offer S-04 a choice that refuses on submit.
    return this.configurationStore
      .list(ORGANIZATION_LEGAL_FORM_CONFIG_KIND)
      .filter((entry) => isStringArray(entry.payload.forms))
      .map((entry) => entry.scope)
      .sort();
  }

  relationshipTypes(): readonly string[] {
    const entry = this.configurationStore.get(
      ORGANIZATION_RELATIONSHIP_TYPE_CONFIG_KIND,
      ORGANIZATION_RELATIONSHIP_TYPE_CONFIG_SCOPE,
    );
    if (!entry) return [];

    const types = entry.payload.types;
    if (!isStringArray(types)) {
      this.logger.error(
        `Configuration entry ${ORGANIZATION_RELATIONSHIP_TYPE_CONFIG_KIND}/` +
          `${ORGANIZATION_RELATIONSHIP_TYPE_CONFIG_SCOPE} (revision ${entry.revision}) is ` +
          `malformed; no relationship type will be admitted`,
      );
      return [];
    }
    return types;
  }
}
