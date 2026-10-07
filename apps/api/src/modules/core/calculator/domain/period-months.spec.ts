import { periodMonths } from './period-months';

describe('periodMonths (task 39.1)', () => {
  it('gives the twelve months of a calendar year, January first', () => {
    expect(periodMonths({ start: '2025-01-01', end: '2025-12-31' })).toEqual([
      '2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06',
      '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12',
    ]);
  });

  it('counts from the start month of a fiscal year, across the year end', () => {
    const months = periodMonths({ start: '2025-04-01', end: '2026-03-31' });
    expect(months?.[0]).toBe('2025-04');
    expect(months?.[8]).toBe('2025-12');
    expect(months?.[9]).toBe('2026-01');
    expect(months?.[11]).toBe('2026-03');
  });

  it('reads the last day of February by the calendar, leap years included', () => {
    expect(periodMonths({ start: '2023-03-01', end: '2024-02-29' })).toHaveLength(12);
    expect(periodMonths({ start: '2023-03-01', end: '2024-02-28' })).toBeNull();
    expect(periodMonths({ start: '2024-03-01', end: '2025-02-28' })).toHaveLength(12);
  });

  it('offers no monthly form to a period that is not twelve whole calendar months', () => {
    // A catch-up period of seven months, one of eighteen, and one starting mid-month (182/15 accepts all three).
    expect(periodMonths({ start: '2025-06-01', end: '2025-12-31' })).toBeNull();
    expect(periodMonths({ start: '2025-01-01', end: '2026-06-30' })).toBeNull();
    expect(periodMonths({ start: '2025-01-15', end: '2026-01-14' })).toBeNull();
    // Ending a day early is not the period the bills cover.
    expect(periodMonths({ start: '2025-01-01', end: '2025-12-30' })).toBeNull();
  });

  it('answers nothing for a date that is not a calendar date string', () => {
    expect(periodMonths({ start: '2025-1-1', end: '2025-12-31' })).toBeNull();
  });
});
