/**
 * `@easyesg/i18n` — locale registry, message loading and fallback reporting.
 *
 * Scope note (architecture.md §10.7, amended with this change): this package does **not** own
 * formatting. next-intl's global `formats`, declared once in `apps/web/src/i18n/request.ts`
 * and referenced by name through `useFormatter` / `getFormatter`, owns it — and a second
 * formatting layer beside it is exactly the drift this package exists to prevent. NFR-26's
 * "no hardcoded format pattern" is enforced there, by a CI lint rule.
 */
export { LOCALES, SOURCE_LOCALE, LOCALES_WITH_OFFICIAL_EFRAG_LABELS, hasOfficialEfragLabels } from './locales';
export type { Locale } from './locales';
export type { MessageCatalogue, MessageLoader } from './messages';
export type { FallbackReport, FallbackReporter } from './fallback-reporter';
export { noopFallbackReporter } from './fallback-reporter';
export { EXPANSION_FACTOR, expandString, expandCatalogue } from './expansion-harness';
