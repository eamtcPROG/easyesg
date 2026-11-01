import { anyDue, daysBetween, daysRemaining, dueNoticeChecks } from './notice-days';

const CHISINAU = 'Europe/Chisinau';
/** 07:00 in Chișinău on 9 October 2026 (UTC+3) — the sweep's slot. */
const SLOT = new Date('2026-10-09T04:00:00Z');
const CADENCE = { repeatIntervalDays: 7, leadTimesDays: [14, 7, 1] } as const;

describe('daysBetween', () => {
  it('counts calendar days, across a month and backwards', () => {
    expect(daysBetween({ from: '2026-10-02', to: '2026-10-09' })).toBe(7);
    expect(daysBetween({ from: '2026-09-25', to: '2026-10-09' })).toBe(14);
    expect(daysBetween({ from: '2026-10-09', to: '2026-10-09' })).toBe(0);
    expect(daysBetween({ from: '2026-10-10', to: '2026-10-09' })).toBe(-1);
  });

  it('is not moved by a change of offset between the two days', () => {
    expect(daysBetween({ from: '2026-10-20', to: '2026-10-27' })).toBe(7);
  });
});

describe('daysRemaining (182/133)', () => {
  it('reads 0 on the due date and negative past it, counted in the due date’s zone', () => {
    expect(daysRemaining({ asOf: SLOT, dueDate: { date: '2026-10-09', timezone: CHISINAU } })).toBe(0);
    expect(daysRemaining({ asOf: SLOT, dueDate: { date: '2026-10-16', timezone: CHISINAU } })).toBe(7);
    expect(daysRemaining({ asOf: SLOT, dueDate: { date: '2026-10-08', timezone: CHISINAU } })).toBe(-1);
  });

  it('counts from the due date’s own day, not UTC’s', () => {
    // 22:30 UTC on the 8th is 01:30 on the 9th in Chișinău: the due date of the 10th is one day off there, two in UTC.
    expect(daysRemaining({ asOf: new Date('2026-10-08T22:30:00Z'), dueDate: { date: '2026-10-10', timezone: CHISINAU } })).toBe(1);
  });
});

describe('dueNoticeChecks (task 51.2)', () => {
  const period = (overrides: Partial<Parameters<typeof dueNoticeChecks>[0]> = {}) =>
    dueNoticeChecks({
      asOf: SLOT,
      timezone: CHISINAU,
      dueDate: null,
      reportCreatedAt: null,
      ...CADENCE,
      ...overrides,
    });

  it('re-evaluates the outstanding notice on each whole interval after the report was created, never on its day', () => {
    expect(period({ reportCreatedAt: new Date('2026-10-02T09:00:00Z') }).outstanding).toBe(true);
    expect(period({ reportCreatedAt: new Date('2026-09-25T09:00:00Z') }).outstanding).toBe(true);
    expect(period({ reportCreatedAt: new Date('2026-10-03T09:00:00Z') }).outstanding).toBe(false);
    expect(period({ reportCreatedAt: new Date('2026-10-09T03:00:00Z') }).outstanding).toBe(false);
  });

  it('counts the report’s day in the period’s zone', () => {
    // 21:30 UTC on 1 October is 00:30 on the 2nd in Chișinău: seven days before the slot there, eight in UTC.
    expect(period({ reportCreatedAt: new Date('2026-10-01T21:30:00Z') }).outstanding).toBe(true);
  });

  it('owes no outstanding check before a report exists, or when the interval cannot be read', () => {
    expect(period().outstanding).toBe(false);
    expect(period({ reportCreatedAt: new Date('2026-10-02T09:00:00Z'), repeatIntervalDays: null }).outstanding).toBe(false);
  });

  it('falls due on the day the days remaining equal a lead time, and on no other', () => {
    const due = (date: string) => period({ dueDate: { date, timezone: CHISINAU } }).leadTime;
    expect(due('2026-10-23')).toBe(14);
    expect(due('2026-10-16')).toBe(7);
    expect(due('2026-10-10')).toBe(1);
    expect(due('2026-10-22')).toBeNull();
    expect(due('2026-10-09')).toBeNull();
    expect(period({ dueDate: { date: '2026-10-16', timezone: CHISINAU }, leadTimesDays: null }).leadTime).toBeNull();
  });

  it('owes nothing for a period with no due date and no report', () => {
    expect(anyDue(period())).toBe(false);
    expect(anyDue(period({ dueDate: { date: '2026-10-16', timezone: CHISINAU } }))).toBe(true);
  });
});
