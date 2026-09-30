import { PROBLEM_TYPE } from '@easyesg/contracts';
import { periodRangeIsOrdered, type ReportingPeriodValue } from '@easyesg/ui';
import { API_OUTCOME, type ApiOutcome } from '@/lib/api-outcome';

/**
 * S-14's form rules over the four values (project owner, 30 Sep 2026): which fiscal years are offered, the dates a
 * chosen year fills in, which fields a save is still missing, and which fields a refusal names. **Pure, and carrying
 * no `server-only`**, so each is a unit spec rather than a browser journey.
 */

/** A field of the picker — what a message is attached to and what a summary links to. */
export type PeriodField = keyof ReportingPeriodValue;

/** The fields a period cannot be saved without, in the order the form draws them. The due date is optional (FR-21). */
export const REQUIRED_FIELDS = ['fiscalYear', 'start', 'end'] as const;

export type RequiredField = (typeof REQUIRED_FIELDS)[number];

/**
 * The years offered around the current one: the last five, for a late filing, and the next, for opening next year's
 * period early (the owner's range). The current year is Chișinău's, read on the server, never the browser's clock.
 */
export const FISCAL_YEARS_BACK = 5;
export const FISCAL_YEARS_AHEAD = 1;

/** The calendar year of an ISO day — the year list's "now", given `todayIn`'s answer read on the server in Chișinău. */
export const yearOfDay = (isoDay: string): number => Number(isoDay.slice(0, 4));

export interface FiscalYearChoice {
  readonly year: number;
  /** Another period of the entity has this year — offered, so the reader sees why it cannot be chosen, but disabled. */
  readonly taken: boolean;
}

/**
 * The fiscal years to offer, **newest first**, as S-14's list orders its periods. A stored period's own year is
 * always among them and never taken — it is this period's — even when it falls outside the range, since the control
 * must be able to show the value it holds.
 */
export const fiscalYearChoices = (input: {
  readonly currentYear: number;
  readonly takenYears: readonly number[];
  readonly ownYear?: number;
}): FiscalYearChoice[] => {
  const years = new Set<number>();
  for (let year = input.currentYear + FISCAL_YEARS_AHEAD; year >= input.currentYear - FISCAL_YEARS_BACK; year -= 1) {
    years.add(year);
  }
  if (input.ownYear !== undefined) years.add(input.ownYear);

  return [...years]
    .toSorted((left, right) => right - left)
    .map((year) => ({ year, taken: year !== input.ownYear && input.takenYears.includes(year) }));
};

/**
 * A chosen year fills the dates with its calendar year — **only while both are empty**, so a date the reader typed is
 * never overwritten, and the dates stay editable for a financial year that straddles two calendar years (FR-21 names
 * the year beside the dates for exactly that case). Most Moldovan SMEs' financial year is the calendar year, which is
 * why the fill is the default rather than a suggestion.
 */
export const withCalendarYearDates = (input: {
  readonly previous: ReportingPeriodValue;
  readonly next: ReportingPeriodValue;
}): ReportingPeriodValue => {
  const { previous, next } = input;
  const yearChosen = next.fiscalYear !== '' && next.fiscalYear !== previous.fiscalYear;
  if (!yearChosen || next.start !== '' || next.end !== '') return next;
  return { ...next, start: `${next.fiscalYear}-01-01`, end: `${next.fiscalYear}-12-31` };
};

/** Which of `REQUIRED_FIELDS` are still empty, in their order. */
export const missingFields = (value: ReportingPeriodValue): RequiredField[] =>
  REQUIRED_FIELDS.filter((field) => value[field] === '');

/**
 * The fields a refusal is about, where its type says so. Only an overlap names fields — another period of the entity
 * already covers part of these dates, so the dates are what to change; every other refusal is about the period as a
 * whole, and its sentence stands alone above the form.
 */
export const refusedFields = (outcome: ApiOutcome<unknown>): RequiredField[] =>
  outcome.status === API_OUTCOME.Problem && outcome.problem.type === PROBLEM_TYPE.PeriodOverlaps
    ? ['start', 'end']
    : [];

/** Why a field is marked — each has its own words, and the form picks them by this. */
export const FIELD_PROBLEM = {
  /** Empty, after a save was pressed. */
  MISSING: 'missing',
  /** Named by an overlap refusal: another period of the entity covers part of these dates. */
  OVERLAPS: 'overlaps',
  /** The end falls before the start — the picker's own rule, listed with the rest once a save was pressed. */
  RANGE: 'range',
} as const;

export type FieldProblem = (typeof FIELD_PROBLEM)[keyof typeof FIELD_PROBLEM];

/** Where a reversed range is marked — the end, as the picker places it: the day most likely mistyped. */
const RANGE_FIELD: RequiredField = 'end';

/** One field's mark: which field, and why. */
export interface FieldMark {
  readonly field: RequiredField;
  readonly problem: FieldProblem;
}

/**
 * What each field says is wrong with it, in the order the form draws them — the fields' messages and the summary above
 * them read this one list, so the two cannot disagree (UX-111). **Missing comes first**, because an empty field is the
 * first thing to fix; a field the refusal named keeps its mark until the next save; the range is the picker's rule and
 * joins the list once a save was pressed, since that is when a summary exists to list it.
 */
export const fieldProblems = (input: {
  readonly value: ReportingPeriodValue;
  /** A save was pressed with something missing or out of order. */
  readonly checked: boolean;
  /** The fields the last refusal named. */
  readonly refused: readonly RequiredField[];
}): FieldMark[] => {
  const missing = input.checked ? missingFields(input.value) : [];
  const reversed = input.checked && !periodRangeIsOrdered(input.value);

  return REQUIRED_FIELDS.flatMap<FieldMark>((field) => {
    if (missing.includes(field)) return [{ field, problem: FIELD_PROBLEM.MISSING }];
    if (input.refused.includes(field)) return [{ field, problem: FIELD_PROBLEM.OVERLAPS }];
    if (field === RANGE_FIELD && reversed) return [{ field, problem: FIELD_PROBLEM.RANGE }];
    return [];
  });
};
