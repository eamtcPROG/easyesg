/**
 * The configuration-store `kind`s this module reads (AD-4, §7.2).
 *
 * Both are spelled with underscores because the seed loader turns filename dashes into them —
 * `config/seed/organization-legal-form.md.json` publishes under `organization_legal_form`. The same
 * note sits on `IDENTITY_PROVIDER_CONFIG_KIND`, and getting it wrong is silent: the entry is simply
 * never found, and the vocabulary reads as unregistered.
 */

/** FR-15's legal forms. **Scope is the ISO 3166-1 alpha-2 country code, lower case** (§7.2). */
export const ORGANIZATION_LEGAL_FORM_CONFIG_KIND = 'organization_legal_form';

/** FR-14's organization types — NFR-9's axis. Scope is `global`; the type set is not per country. */
export const ORGANIZATION_RELATIONSHIP_TYPE_CONFIG_KIND = 'organization_relationship_type';

/** The one scope the relationship-type vocabulary is published under. */
export const ORGANIZATION_RELATIONSHIP_TYPE_CONFIG_SCOPE = 'global';

/**
 * FR-17's activity classification. **Scope is the country code**, like legal forms: the classifier
 * is national. Moldova's is CAEM Rev.2, which the National Bureau of Statistics harmonises 1:1 with
 * NACE Rev.2 up to four characters — so a code recorded here is a NACE code, which is what B1
 * exports.
 */
export const NACE_CODE_CONFIG_KIND = 'nace_code';
