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
 * **`LOCALES_WITH_OFFICIAL_EFRAG_LABELS` and `hasOfficialEfragLabels` were here and are gone**
 * (task 33.2, 1 Sep 2026). They answered NFR-24's "does EFRAG publish this locale's VSME labels"
 * as a property of a locale, and both the answer and the shape were wrong.
 *
 * The answer: the constant read `['ro', 'en']`, and opening the published `2026-05-01` package
 * showed Romanian's label linkbase is a **stub** — twelve of 23 language files carry labels and
 * `ro` holds zero. The amendment that corrected T-14, NFR-23, NFR-24, UX-47 and UX-98 reached the
 * doc set and stopped there, which is the "a rule is applied where it holds, not where it was
 * found" failure in CLAUDE.md; nothing imported these two, so nothing failed.
 *
 * The shape, which is why they were deleted rather than edited: standing belongs to
 * `(version, locale)`. EFRAG ships that stub as a file it evidently means to fill, and the release
 * that fills it makes Romanian official for **that** version and no earlier one — while a report
 * pinned to `2026-05-01` must still state its Romanian labels were platform-authored (DR-4). The
 * replacement is `DisclosureLabelResolver.standing()` in `apps/api`'s `platform/localization`,
 * reading a `standing.json` manifest the extractor derives from EFRAG's own linkbases. The
 * vocabulary it answers in is `./disclosure-standing.js`, next to this file; the catalogues are read
 * over there rather than here, and that module's docblock says why.
 */

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
