/**
 * Locale registry consumption for the console.
 *
 * NOT BUILT — a docblock over an empty export.
 *
 * The console is Romanian-only at MVP (see `app/routes/__root.tsx` for the reasoning and
 * architecture.md §18 for the record). That is a decision about how many catalogues the *chrome*
 * ships in — it is not permission to put a sentence in a `.tsx` file.
 *
 * Every string a person reads still resolves through a message key against the configuration
 * store, because FR-61/FR-62 require wording to be publishable within a working day and
 * revertible in one step (NFR-85), and a literal in code needs a release. The ESLint JSXText rule
 * enforces this and applies to this app.
 *
 * `LOCALES` and `SOURCE_LOCALE` come from `@easyesg/i18n` — the same registry apps/web and the
 * export pipeline read. The console reads that list even while rendering one of them, because
 * A-03 is where an operator authors all three and registers a fourth (FR-63).
 *
 * Formatting is NOT free-hand. NFR-26 requires every number, date and currency be derived from
 * the active locale with no hardcoded pattern, and its stated verification is a static analysis
 * rule: `toFixed`, `toLocaleString` and `new Intl.*Format` are lint errors in this app, exactly as
 * in apps/web. Named formats belong in `formats.ts` and are reached by name.
 *
 * Instants on the wire are epoch-millisecond integers. Anything a timezone would change the legal
 * answer to — an invoice date, a fiscal year, a factor set's effective date, the BNM rate date —
 * is a calendar date carrying its originating timezone (NFR-34), and must not be formatted as if
 * it were an instant.
 */
export {};
