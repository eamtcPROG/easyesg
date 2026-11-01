import {
  EXPANSION_FLAG,
  SOURCE_LOCALE,
  expandCatalogue,
  expansionEnabled,
  type Locale,
  type MessageCatalogue,
} from '@easyesg/i18n';
import ro from '~/messages/ro.json';

/**
 * Locale registry consumption for the console.
 *
 * The console renders in Romanian only (architecture.md OQ-42, closed 19 Aug 2026). That is a
 * decision about how many catalogues the *chrome* ships in — it is **not** permission to put a
 * sentence in a `.tsx` file. Every string a person reads still resolves through a message key,
 * and the ESLint JSXText rule enforces it here as it does in `apps/web`.
 *
 * Catalogue text is committed rather than fetched (architecture.md OQ-43, closed 19 Aug 2026),
 * which matters more here than in the tenant app: this is a static Vite bundle with no
 * rendering tier, so an API-backed catalogue would mean a blocking cross-origin fetch to
 * `api.<host>` before the first paint — and a sign-in screen with no words if it failed.
 *
 * `LOCALES` is still exported for A-03, the screen on which an operator authors all three
 * locales and registers a fourth (FR-63). Reading the registry while rendering one of its
 * members is deliberate, not an inconsistency.
 */
export { LOCALES, SOURCE_LOCALE, type Locale } from '@easyesg/i18n';
export { formats } from './formats';

/**
 * The console's own locale. A constant rather than a lookup: OQ-42 is a closed decision, and a
 * resolver here would be an extension point for a requirement nobody has — CLAUDE.md's rule
 * against widening a question by coding around it. Adding a console locale changes this line
 * and adds a catalogue file.
 */
export const CONSOLE_LOCALE: Locale = SOURCE_LOCALE;

/**
 * The +40% expansion harness (UX-94). `import.meta.env` rather than `process.env`: this is a
 * Vite bundle, and `VITE_`-prefixed values are inlined at build time — so the console's harness
 * is switched when the artefact is built, not when it is served. One more reason a staging build
 * is not promotable to production here (`apps/admin/CLAUDE.md`).
 */
const PSEUDOLOCALE = expansionEnabled(import.meta.env[`VITE_${EXPANSION_FLAG}`] as string | undefined);

export const messages: MessageCatalogue = PSEUDOLOCALE ? expandCatalogue(ro) : ro;

/**
 * `use-intl` is `next-intl`'s framework-agnostic core and is pinned to the same version
 * (architecture.md §12.1), so a message that renders in the tenant application renders
 * identically here — one ICU syntax, one `Formats` shape, no second dialect to keep in step.
 */
export { IntlProvider, useTranslations, useFormatter } from 'use-intl';

/**
 * Instants on the wire are epoch-millisecond integers. Anything a timezone would change the
 * legal answer to — an invoice date, a fiscal year, a factor set's effective date, the BNM rate
 * date — is a calendar date carrying its originating timezone (NFR-34) and must not be
 * formatted as if it were an instant.
 *
 * Moldova's filing calendar is what a legal date is read against, so the console renders in it
 * rather than in the operator's own zone: two operators in different countries reading the same
 * ledger row must see the same date, and that date must be the one the document was issued on.
 */
export const CONSOLE_TIME_ZONE = 'Europe/Chisinau';
