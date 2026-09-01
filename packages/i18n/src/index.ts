/**
 * `@easyesg/i18n` — locale registry, message loading and fallback reporting.
 *
 * Scope note (architecture.md §10.7, amended 18 Aug 2026): this package does **not** own
 * formatting. Each app declares its own named `formats` — `apps/web/src/i18n/formats.ts` and
 * `apps/admin/src/i18n/formats.ts` — reached by name through `useFormatter` / `getFormatter`.
 * A shared formatting layer beside next-intl's own is exactly the drift that amendment exists
 * to prevent, so the two files are kept identical by review rather than by an abstraction.
 * NFR-26's "no hardcoded format pattern" is enforced in both, by a CI lint rule.
 */
export { LOCALES, SOURCE_LOCALE, isLocale, toLocale } from './locales.js';
export type { Locale } from './locales.js';
export { LABEL_STANDING, isLabelStanding } from './disclosure-standing.js';
export type {
  LabelStanding,
  DisclosureLabel,
  LabelStandingManifest,
} from './disclosure-standing.js';
export type { MessageCatalogue, MessageLoader } from './messages.js';
export { leafKeys, compareToSource, blankKeys } from './parity.js';
export type { ParityResult } from './parity.js';
export type { FallbackReport, FallbackReporter } from './fallback-reporter.js';
export { noopFallbackReporter } from './fallback-reporter.js';
export {
  EXPANSION_FACTOR,
  EXPANSION_FLAG,
  expansionEnabled,
  expandString,
  expandCatalogue,
} from './expansion-harness.js';
export { findInternalIdentifiers } from './internal-identifiers.js';
export type { IdentifierFinding } from './internal-identifiers.js';
