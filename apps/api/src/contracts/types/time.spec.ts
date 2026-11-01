import { calendarDateIn } from './time';

describe('calendarDateIn', () => {
  it('answers the day the instant falls on in the zone asked, not in UTC', () => {
    // 22:30 UTC on 31 December is already 1 January in Chișinău (UTC+2) and still 31 December in New York.
    const instant = new Date('2026-12-31T22:30:00Z');
    expect(calendarDateIn({ instant, timezone: 'Europe/Chisinau' })).toBe('2027-01-01');
    expect(calendarDateIn({ instant, timezone: 'UTC' })).toBe('2026-12-31');
    expect(calendarDateIn({ instant, timezone: 'America/New_York' })).toBe('2026-12-31');
  });

  it('zero-pads the month and the day', () => {
    expect(calendarDateIn({ instant: new Date('2026-03-05T12:00:00Z'), timezone: 'UTC' })).toBe('2026-03-05');
  });
});
