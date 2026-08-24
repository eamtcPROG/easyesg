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

/**
 * Is this unvalidated value one of the live locales?
 *
 * **The predicate and `toLocale` below are two different operations and the difference is not
 * cosmetic** — which is what a private copy in each consumer stopped making visible. Use this
 * one wherever a non-match must be *handled by the caller* rather than absorbed:
 * `negotiateLocale` is the worked example, because it tests each `Accept-Language` tag in
 * preference order and a fallback applied inside that loop would answer the source locale for
 * the first unsupported tag instead of trying the reader's second choice — a wrong answer that
 * looks right, since the source locale is a plausible response to every request.
 */
export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/**
 * An unvalidated value narrowed to a live locale, falling back to the source locale.
 *
 * Takes `unknown` because every caller is at a trust boundary — a `text` column, a queued job
 * payload, a cookie — and the fallback is the point: a locale RETIRED since the value was
 * written (NFR-25 makes the set configuration) must not strand the row, the email or the
 * session. Source is the same fallback FR-10 already specifies per string, so this adds no new
 * rule; it stops five copies of one from disagreeing.
 */
export function toLocale(value: unknown): Locale {
  return isLocale(value) ? value : SOURCE_LOCALE;
}
