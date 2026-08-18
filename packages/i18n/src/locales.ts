/**
 * The live locale set — three at MVP (NFR-23, ratified 18 Aug 2026).
 *
 * Romanian is the SOURCE locale. English and Russian are each separately authored and never
 * machine-translated (problem_overview C9). NFR-4 imposes no architectural limit on locale
 * count and NFR-25 requires a fourth to be addable through content and configuration alone —
 * no code change, no schema change, no redeploy. That is why this file holds identifiers and
 * nothing else: adding a locale must never mean editing a component.
 */
export const LOCALES = ['ro', 'en', 'ru'] as const;

export type Locale = (typeof LOCALES)[number];

export const SOURCE_LOCALE = 'ro' satisfies Locale;

/**
 * NFR-24 obliges the platform to use EFRAG's official translation of a VSME label verbatim
 * wherever one is published. EFRAG ships the Digital Template in EU languages, and Russian is
 * not one — so Russian VSME labels are platform-authored and carry no official standing.
 *
 * The export must SAY so rather than imply it (design_spec UX-47, UX-98), and a report headed
 * for a bank or an EU buyer should be produced in RO or EN.
 */
export const LOCALES_WITH_OFFICIAL_EFRAG_LABELS = ['ro', 'en'] as const satisfies readonly Locale[];

export function hasOfficialEfragLabels(locale: Locale): boolean {
  return (LOCALES_WITH_OFFICIAL_EFRAG_LABELS as readonly Locale[]).includes(locale);
}
