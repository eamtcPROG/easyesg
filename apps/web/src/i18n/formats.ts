import type { Formats } from 'next-intl';

/**
 * The named format set — **this file is how NFR-26 is satisfied.**
 *
 * NFR-26: "format all dates, numbers, units and currency values from the active locale, using
 * no hardcoded format pattern", verified by "a static analysis rule in CI". Declaring every
 * format here and referencing it *by name* from components means there is nowhere else to put
 * a pattern; the lint rule enforces what this file makes natural.
 *
 *     const format = useFormatter();
 *     format.number(consumption, 'decimal');   // ✅ named
 *     value.toFixed(2);                        // ❌ lint error
 *
 * The Moldovan conventions the design set specifies — space thousands separator, comma decimal
 * (`1 240,50`) — are the OUTPUT of the `ro` locale applied to these options, never a pattern
 * typed anywhere. Switching to `en` yields `1,240.50` from the same declaration, which is the
 * whole point: §7.8 compares golden reports "after locale normalisation … of values, not bytes".
 *
 * Note what is deliberately absent: no format for tCO2e or MWh. `tonne` and `megawatt-hour`
 * are not sanctioned Intl units, and a unit label is translatable content that belongs in the
 * message catalogue (FR-61) beside the number, not baked into a formatter.
 */
export const formats = {
  dateTime: {
    // A calendar date a user reads. Instants arrive as epoch milliseconds and become strings
    // only here — apps/web is the single place that conversion happens (§6.8).
    short: { day: 'numeric', month: 'short', year: 'numeric' },
    long: { day: 'numeric', month: 'long', year: 'numeric' },
    // Audit surfaces: S-12 field change history, provenance, delivery records.
    stamp: { dateStyle: 'medium', timeStyle: 'short' },
    /**
     * A bare year — the copyright notice, and later any year-only label.
     *
     * It exists as a *date* format rather than being interpolated as a number on purpose: ICU
     * formats a plain `{year}` argument holding a number, so `2026` renders as "2,026" in `en`
     * and "2 026" in `ro`/`ru`, where the space thousands separator is exactly the convention
     * §11 asked for everywhere else. Formatting the date yields "2026" in every locale, which
     * is what a year is.
     */
    year: { year: 'numeric' },
  },
  number: {
    // Headcount, site counts, anything countable.
    integer: { maximumFractionDigits: 0 },
    // Consumption and emissions figures. Two places is the reporting convention; the unit
    // label comes from the catalogue.
    decimal: { minimumFractionDigits: 2, maximumFractionDigits: 2 },
    // Gender pay gap (B10), turnover rate (B8), completeness.
    percent: { style: 'percent', maximumFractionDigits: 1 },
    // MDL is the ledger currency (D-14). A document issued in EUR or USD passes its own
    // currency explicitly — that is data off the invoice record, not a hardcoded pattern.
    money: { style: 'currency', currency: 'MDL' },
  },
  list: {
    // "Romanian, English and Russian" — never assembled by concatenation. UX-95 prohibits
    // concatenated sentence fragments: every message is a whole, translatable unit.
    enumeration: { style: 'long', type: 'conjunction' },
  },
} satisfies Formats;
