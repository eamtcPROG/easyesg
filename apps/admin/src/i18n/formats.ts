/**
 * Named format declarations — the whole of NFR-26's compliance mechanism in this app.
 *
 * NOT BUILT — a docblock over an empty export.
 *
 * Components reach formats by name; they never construct one. apps/web's `src/i18n/formats.ts` is
 * the shape to follow: date-time short/long/stamp, number integer/decimal/percent/money, list
 * enumeration.
 *
 * Money in this console is mostly MDL, the ledger currency (D-14), but A-16 and A-12 both show
 * foreign-currency invoices against their BNM rate. The rate *date* is a calendar date (FR-129,
 * NFR-34); the amount is a decimal string that must not pass through a float — apps/api keeps
 * `numeric` as a string for exactly this reason (NFR-58), and parsing it here to format it
 * reintroduces the defect at the last possible moment.
 */
export {};
