import type { Formats } from 'use-intl';

/**
 * The named format set for the console — **this file is how NFR-26 is satisfied here.**
 *
 * NFR-26 binds every surface, not just the tenant application: "format all dates, numbers,
 * units and currency values from the active locale, using no hardcoded format pattern",
 * verified by "a static analysis rule in CI". `toFixed`, `toLocaleString` and `new Intl.*Format`
 * are lint errors in this app exactly as in `apps/web`, so a pattern has nowhere to live except
 * here, reached by name:
 *
 *     const format = useFormatter();
 *     format.number(amount, 'money');   // ✅ named
 *     amount.toFixed(2);                // ❌ lint error
 *
 * **Deliberately identical to `apps/web/src/i18n/formats.ts`.** The console reads the same
 * invoices, the same metering counters and the same emissions figures the tenant sees, and an
 * operator comparing the two screens during a support call must not be reading two roundings.
 * `packages/i18n` does not own this (architecture.md §10.7, amended 18 Aug 2026): a shared
 * formatting layer beside next-intl's own `formats` is the drift that amendment exists to
 * prevent, so the two files are kept in step by review, not by an abstraction.
 *
 * The console renders in Romanian only (architecture.md OQ-42), but nothing here says so —
 * these are options, not patterns, and they yield Russian or English output unchanged if a
 * console locale is ever added.
 */
export const formats = {
  dateTime: {
    // A calendar date an operator reads. Instants arrive as epoch milliseconds and become
    // strings only here (§6.8).
    short: { day: 'numeric', month: 'short', year: 'numeric' },
    long: { day: 'numeric', month: 'long', year: 'numeric' },
    // Audit and ledger surfaces: A-08, the reconciliation exception detail, support-access
    // grants. Every one of these is read to answer "when exactly", so it carries a time.
    stamp: { dateStyle: 'medium', timeStyle: 'short' },
  },
  number: {
    integer: { maximumFractionDigits: 0 },
    decimal: { minimumFractionDigits: 2, maximumFractionDigits: 2 },
    percent: { style: 'percent', maximumFractionDigits: 1 },
    // MDL is the ledger currency (D-14). A document issued in EUR or USD passes its own
    // currency explicitly — that is data off the invoice record, not a hardcoded pattern.
    money: { style: 'currency', currency: 'MDL' },
  },
  list: {
    // UX-95 prohibits concatenated sentence fragments: every message is a whole, translatable
    // unit with named placeholders.
    enumeration: { style: 'long', type: 'conjunction' },
  },
} satisfies Formats;
