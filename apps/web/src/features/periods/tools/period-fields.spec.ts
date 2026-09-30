import { describe, expect, it } from 'vitest';
import type { ReportingPeriodValue } from '@easyesg/ui';
import {
  fieldProblems,
  fiscalYearChoices,
  missingFields,
  refusedFields,
  withCalendarYearDates,
  yearOfDay,
} from './period-fields';

/**
 * S-14's form rules (30 Sep 2026) — the year list, the calendar-year fill, what a save is missing and what a refusal
 * names. Each arm here is one a browser journey would have to contrive a clock or a colliding period to reach.
 */
const EMPTY: ReportingPeriodValue = { fiscalYear: '', start: '', end: '', due: '' };

describe('yearOfDay', () => {
  it('reads the year of an ISO day as a number — the late-December day included, which belongs to its own year', () => {
    expect(yearOfDay('2026-12-31')).toBe(2026);
    expect(yearOfDay('2027-01-01')).toBe(2027);
  });
});

describe('fiscalYearChoices', () => {
  it('offers next year and the last five, newest first, and marks a year another period holds', () => {
    const choices = fiscalYearChoices({ currentYear: 2026, takenYears: [2025] });

    expect(choices.map((choice) => choice.year)).toEqual([2027, 2026, 2025, 2024, 2023, 2022, 2021]);
    expect(choices.filter((choice) => choice.taken).map((choice) => choice.year)).toEqual([2025]);
  });

  it('keeps a stored period’s own year choosable, and offers it even outside the range', () => {
    const own = fiscalYearChoices({ currentYear: 2026, takenYears: [2025, 2018], ownYear: 2018 });

    // Its own year is this period's, not another's — so it is offered and not taken.
    expect(own.find((choice) => choice.year === 2018)).toEqual({ year: 2018, taken: false });
    expect(own.at(-1)?.year).toBe(2018);
    expect(own.find((choice) => choice.year === 2025)?.taken).toBe(true);
  });
});

describe('withCalendarYearDates', () => {
  it('fills the dates with the chosen year while both are empty', () => {
    expect(withCalendarYearDates({ previous: EMPTY, next: { ...EMPTY, fiscalYear: '2026' } })).toEqual({
      fiscalYear: '2026',
      start: '2026-01-01',
      end: '2026-12-31',
      due: '',
    });
  });

  it('never overwrites a date the reader typed, and does nothing when the year did not change', () => {
    const typed = { ...EMPTY, start: '2025-07-01' };
    expect(withCalendarYearDates({ previous: typed, next: { ...typed, fiscalYear: '2026' } })).toEqual({
      ...typed,
      fiscalYear: '2026',
    });

    // Clearing a date the fill wrote is the reader's decision; editing another field must not refill it.
    const cleared = { ...EMPTY, fiscalYear: '2026' };
    expect(withCalendarYearDates({ previous: cleared, next: { ...cleared, due: '2027-04-30' } })).toEqual({
      ...cleared,
      due: '2027-04-30',
    });
  });
});

describe('missingFields', () => {
  it('names the year and both dates while empty, in the order the form draws them, and never the due date', () => {
    expect(missingFields(EMPTY)).toEqual(['fiscalYear', 'start', 'end']);
    expect(missingFields({ ...EMPTY, fiscalYear: '2026', start: '2026-01-01' })).toEqual(['end']);
    expect(missingFields({ fiscalYear: '2026', start: '2026-01-01', end: '2026-12-31', due: '' })).toEqual([]);
  });
});

describe('refusedFields', () => {
  const problem = (type: string) =>
    ({ status: 'problem', problem: { type, status: 409, title: 't', detail: 'd' } }) as const;

  it('names the two dates for an overlap, and nothing for any other refusal or an answer', () => {
    expect(refusedFields(problem('https://easyesg.md/problems/period-overlaps'))).toEqual(['start', 'end']);
    expect(refusedFields(problem('https://easyesg.md/problems/validation-failed'))).toEqual([]);
    expect(refusedFields({ status: 'unreachable' })).toEqual([]);
    expect(refusedFields({ status: 'ok', value: undefined, messages: [] })).toEqual([]);
  });
});

describe('fieldProblems', () => {
  it('says nothing before a save is pressed, however empty the form', () => {
    expect(fieldProblems({ value: EMPTY, checked: false, refused: [] })).toEqual([]);
  });

  it('names each missing field once a save is pressed, in the order the form draws them', () => {
    expect(fieldProblems({ value: { ...EMPTY, start: '2026-01-01' }, checked: true, refused: [] })).toEqual([
      { field: 'fiscalYear', problem: 'missing' },
      { field: 'end', problem: 'missing' },
    ]);
  });

  it('marks the dates an overlap named, and a reversed range on the end once a save is pressed', () => {
    const filled = { fiscalYear: '2026', start: '2026-01-01', end: '2026-12-31', due: '' };
    expect(fieldProblems({ value: filled, checked: false, refused: ['start', 'end'] })).toEqual([
      { field: 'start', problem: 'overlaps' },
      { field: 'end', problem: 'overlaps' },
    ]);
    expect(fieldProblems({ value: { ...filled, end: '2025-12-31' }, checked: true, refused: [] })).toEqual([
      { field: 'end', problem: 'range' },
    ]);
  });
});
