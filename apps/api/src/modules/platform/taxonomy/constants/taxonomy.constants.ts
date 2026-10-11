/**
 * The configuration kinds `platform/taxonomy` reads (AD-4, DR-3).
 *
 * Each is a `config/seed/<kind>.<scope>.json` file with its dashes turned into underscores by the
 * loader — there is no table and no code per artefact, which is what task 16's store being generic
 * is for.
 */

/** One registered taxonomy version. **Scope is the version** — `2026-05-01` (OQ-45). */
export const VSME_TAXONOMY_CONFIG_KIND = 'vsme_taxonomy';

/**
 * One registered EFRAG Digital Template (task 45.3; FR-50, DR-4). **Scope is the template's version, EFRAG's own
 * release identifier** — `1.3.0` — by OQ-45's reasoning applied to the template (`architecture.md` §12.5.6's task-45
 * row (1)): the identifier is EFRAG's, printed in the workbook itself, and not ours to invent. The binary is
 * committed under `config/efrag/<version>/` and registered here; nobody uploads it (182/48).
 */
export const VSME_DIGITAL_TEMPLATE_CONFIG_KIND = 'vsme_digital_template';

/**
 * Where the Excel export writes each value into one registered template (task 46.1; `architecture.md` §12.5.6's
 * task-46 row (1)). **Scope is the template's version**, as its registration's is; generated from the binary by
 * `tools/extract-vsme-template-map.mjs`, never authored.
 */
export const VSME_DIGITAL_TEMPLATE_MAP_CONFIG_KIND = 'vsme_digital_template_map';

/**
 * Which version a period or report opened today is pinned to. **Scope is the standard**, and the
 * entry is effective-dated by the store's own schedule, because scheduling an adoption is a publish
 * rather than a release (OQ-45).
 */
export const REPORTING_TAXONOMY_CONFIG_KIND = 'reporting_taxonomy';

/**
 * A domain published in a taxonomy of its own and referenced by a VSME axis — the EU List of Waste
 * behind B7's `TypeOfWasteAxis` is the only one at `2026-05-01`.
 *
 * **The kind is derived from the axis's own `domainTaxonomy`, in this one function**, so the naming
 * convention the extractor writes and the one the registry reads are the same statement rather than
 * two that must be kept in step. Scope is the domain taxonomy's version, which is independent of
 * VSME's: DR-4 makes version a data dimension, and the waste list revises on its own calendar.
 */
export const externalDomainConfigKind = (domainTaxonomy: string): string =>
  `vsme_${domainTaxonomy}_classification`;

/** The reporting standards this platform registers taxonomies for. */
export const TAXONOMY_STANDARD = { VSME: 'vsme' } as const;
export type TaxonomyStandard = (typeof TAXONOMY_STANDARD)[keyof typeof TAXONOMY_STANDARD];
