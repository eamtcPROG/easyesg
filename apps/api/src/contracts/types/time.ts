/**
 * Time primitives.
 *
 * `EpochMillis` is a Unix timestamp in milliseconds, UTC-based — the representation for every
 * instant **on the wire and in DTOs**. The alias exists because OpenAPI can only type it
 * `integer`, so the contract cannot say what the number means; the type name is where that
 * survives. Name the field so it reads as a time too, and state the unit in `@ApiProperty`.
 *
 * **Storage is `timestamptz`, not this** (architecture.md §7.8, §7.9; OQ-50, closed 19 Aug 2026 —
 * this comment previously said "in storage" and was wrong). The conversion happens once, where a
 * persistence row becomes a DTO. It must not leak inward: a use-case or domain signature taking a
 * number of milliseconds has admitted the wire format into the core, which is the dependency
 * direction the layering exists to prevent.
 */
export type EpochMillis = number;

/**
 * When an outbox row's transaction began, as epoch **microseconds** — the database's own precision (task 50.1's
 * parent close; §12.5.6's task-50.1 row, *how task 50.1 builds it*).
 *
 * **An ordering value, never a time to show or to convert**, and not the wire's `EpochMillis`: its one use is to
 * order two outbox rows — a notice's raise against its key's cancellation — that parallel workers may process in
 * either order. A `Date` keeps milliseconds only, so two transactions inside one millisecond would tie, and a tie is
 * resolved as a cancellation. An integer count of microseconds is exact in a JavaScript number until the year 2255,
 * and the database turns it back into a `timestamptz` with integer arithmetic, so nothing is rounded either way.
 */
export type EpochMicros = number;

/**
 * A calendar date with legal force, as `YYYY-MM-DD`, paired with the timezone that determines it.
 *
 * NOT an instant, and the distinction is not stylistic. NFR-34 requires the originating timezone
 * wherever a legal date is determined, because an instant cannot settle which fiscal year a
 * document falls in: an invoice dated 31 December encoded as an epoch value lands in the wrong
 * year, and FR-125 makes that uncorrectable by editing — only by credit note.
 *
 * Use for invoice and credit-note dates, number-series fiscal years (AD-7, DR-8), reporting period
 * start/end/due (FR-21), the BNM rate date (FR-129), and effective dates on VAT rules, factor sets
 * and thresholds (AD-4).
 *
 * The test: would a different timezone change the answer to a legal or regulatory question?
 */
export interface LegalDate {
  /** ISO 8601 calendar date, `YYYY-MM-DD`. No time, no offset. */
  date: string;
  /** IANA zone that determined it, e.g. `Europe/Chisinau`. */
  timezone: string;
}

/**
 * Whether a string names a zone the IANA database carries.
 *
 * **Beside `LegalDate` rather than in whichever module first needed one**, which is the rule
 * CLAUDE.md states for operations over a shared vocabulary and the failure it describes for
 * `toLocale`: retyped per caller, each copy locally correct, and no test able to see them diverge.
 * Task 31.1 is the first consumer (reporting period boundaries) and task 57 is the second (invoice
 * and credit-note dates), so the second copy was already scheduled.
 *
 * `Intl` is the check because it *is* the database the runtime carries — a hand-kept list would be
 * a fourth copy of tzdata that ages against the two Node ships and Postgres holds. It throws a
 * `RangeError` on an unknown zone, which is the only way to ask.
 */
export const isIanaTimeZone = (value: string): boolean => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
};

/**
 * Whether a value is a well-formed `LegalDate`: an ISO calendar date that **is the day it spells**,
 * paired with a real zone.
 *
 * The round-trip is what makes it more than a regex. `2026-02-30` matches the shape and `Date`
 * accepts it, rolling forward to 2 March — so a period boundary the user never typed would be
 * stored, and a fiscal year would be settled by a silent correction. Comparing the parsed date's
 * own ISO rendering back to the input is what refuses it.
 */
export const isLegalDate = (value: LegalDate): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.date)) return false;
  const parsed = new Date(`${value.date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  if (parsed.toISOString().slice(0, 10) !== value.date) return false;
  return isIanaTimeZone(value.timezone);
};

/**
 * The calendar day an instant falls on in a zone, as `YYYY-MM-DD` (task 41.1).
 *
 * **Beside `LegalDate` because it is the way one is made from an instant**, and the question NFR-34 asks of every date
 * is which zone answered it. FR-73's *the date the period was locked* is the first reader: a lock at 23:30 in Chișinău
 * is a lock on that day there, and the next day in UTC — and which rule set a locked report reads turns on it.
 *
 * `en-CA` is not a locale choice: it is the one whose short date is already ISO 8601's `YYYY-MM-DD`, and the parts are
 * read by type rather than by position, so nothing depends on how the locale orders them.
 */
export const calendarDateIn = (input: { readonly instant: Date; readonly timezone: string }): string => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: input.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(input.instant);
  const part = (type: Intl.DateTimeFormatPartTypes): string => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
};
