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
