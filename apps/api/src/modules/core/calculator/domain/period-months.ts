/**
 * The calendar months S-09's monthly form stands for — or that the period offers no monthly form (task 39.1; FR-33;
 * `architecture.md` §12.5.6's task-39 row (1)).
 *
 * **Twelve rows by position from the period's start month**, so a fiscal year from 1 April has April first. **Only a
 * period of twelve whole calendar months offers them**: it starts on a month's first day and ends on the last day of
 * the eleventh month after. FR-21 accepts a period of any length (182/15), and a bill is a calendar month's — a
 * catch-up period of seven or eighteen months, or one starting mid-month, keeps the line's single figure rather than
 * twelve rows that do not fit it.
 *
 * Calendar dates in, calendar months out (NFR-34): `YYYY-MM-DD` strings compared as dates, never instants, so no
 * timezone can move a boundary. Which month a row stands for is computed where it is shown and refused where it is
 * written; nothing stores it, so a period whose dates are corrected relabels its rows rather than orphaning them.
 */

/** How many rows the monthly form has. */
export const MONTHS_IN_FORM = 12;

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `YYYY-MM` for a year and a month counted from one, months past December carrying into the next year. */
const monthOf = (input: { readonly year: number; readonly month: number }): string => {
  const zeroBased = input.month - 1;
  const year = input.year + Math.floor(zeroBased / 12);
  const month = (zeroBased % 12) + 1;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
};

/** The last day of a month — 28 to 31 — by the proleptic Gregorian calendar, computed in UTC so no zone moves it. */
const lastDayOf = (month: string): number => {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
};

export function periodMonths(period: { readonly start: string; readonly end: string }): readonly string[] | null {
  const start = DATE.exec(period.start);
  const end = DATE.exec(period.end);
  if (start === null || end === null || Number(start[3]) !== 1) return null;

  const first = { year: Number(start[1]), month: Number(start[2]) };
  const months = Array.from({ length: MONTHS_IN_FORM }, (_, index) =>
    monthOf({ year: first.year, month: first.month + index }),
  );
  const last = months[MONTHS_IN_FORM - 1];
  return `${end[1]}-${end[2]}` === last && Number(end[3]) === lastDayOf(last) ? months : null;
}
