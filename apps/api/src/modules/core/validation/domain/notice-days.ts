import { calendarDateIn, type LegalDate } from '@api/contracts/types/time';

/**
 * Which of a period's notices fall due on a day (task 51.2; FR-164, FR-165; `architecture.md` §12.5.6's task-51.2 row
 * (2), (d), and 182/133).
 *
 * **Every day is a calendar day in a named zone, never an instant's UTC date**: the outstanding notice repeats on the
 * days a whole interval after the report was created, counted in the period's own zone, and the days remaining before a
 * due date are counted in the due date's zone (182/133) — so a due date that is today there reads 0, never 1.
 */

/** Whole calendar days from one `YYYY-MM-DD` to another — negative when `to` is earlier. */
export function daysBetween(input: { readonly from: string; readonly to: string }): number {
  const utc = (date: string): number => {
    const [year, month, day] = date.split('-').map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((utc(input.to) - utc(input.from)) / 86_400_000);
}

/** 182/133's days remaining: from today's date in the due date's own zone to the due date. */
export const daysRemaining = (input: { readonly asOf: Date; readonly dueDate: LegalDate }): number =>
  daysBetween({ from: calendarDateIn({ instant: input.asOf, timezone: input.dueDate.timezone }), to: input.dueDate.date });

/** What a check of one period owes on a day. */
export interface DueNoticeChecks {
  /** The outstanding-report notice is re-evaluated — a whole repeat interval since the report was created. */
  readonly outstanding: boolean;
  /** The lead time whose deadline notice falls due, or `null` where the days remaining are none of them. */
  readonly leadTime: number | null;
}

export function dueNoticeChecks(input: {
  readonly asOf: Date;
  /** The zone the period's own days are counted in — its start's (`period_start_tz`). */
  readonly timezone: string;
  readonly dueDate: LegalDate | null;
  /** When the period's report was created; `null` while it has none. */
  readonly reportCreatedAt: Date | null;
  /** `null` where the category's cadence cannot be read — the notice is then not raised. */
  readonly repeatIntervalDays: number | null;
  readonly leadTimesDays: readonly number[] | null;
}): DueNoticeChecks {
  let outstanding = false;
  if (input.reportCreatedAt !== null && input.repeatIntervalDays !== null) {
    const days = daysBetween({
      from: calendarDateIn({ instant: input.reportCreatedAt, timezone: input.timezone }),
      to: calendarDateIn({ instant: input.asOf, timezone: input.timezone }),
    });
    outstanding = days > 0 && days % input.repeatIntervalDays === 0;
  }

  let leadTime: number | null = null;
  if (input.dueDate !== null && input.leadTimesDays !== null) {
    const remaining = daysRemaining({ asOf: input.asOf, dueDate: input.dueDate });
    leadTime = input.leadTimesDays.includes(remaining) ? remaining : null;
  }
  return { outstanding, leadTime };
}

/** Whether a check owes anything at all — the sweep schedules only the periods that do. */
export const anyDue = (checks: DueNoticeChecks): boolean => checks.outstanding || checks.leadTime !== null;
