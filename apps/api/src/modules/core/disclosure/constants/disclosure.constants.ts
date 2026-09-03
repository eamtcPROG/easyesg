/**
 * The configuration-store `kind`s `core/disclosure` reads (AD-4, DR-3).
 *
 * Underscores because the seed loader turns a filename's dashes into them —
 * `config/seed/disclosure-applicability.vsme.json` publishes under `disclosure_applicability`.
 * Getting it wrong is silent: the entry is simply never found.
 */

/**
 * FR-28's conditional-applicability rules (FR-72, task 91.3). **Scope is the standard**, on
 * `reporting_taxonomy`'s precedent: 50 and 150 are VSME's own numbers, and what transposing
 * legislation moves is carried by the store's own effective dating rather than by a second scope.
 */
export const DISCLOSURE_APPLICABILITY_CONFIG_KIND = 'disclosure_applicability';
