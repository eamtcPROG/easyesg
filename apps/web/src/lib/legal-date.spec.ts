import { createFormatter } from 'next-intl';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { formats } from '@/i18n/formats';
import { calendarDay } from './legal-date';

describe('calendarDay', () => {
  // **The host's zone, set east of UTC for this file** (task 179's gate-integrity review): CI's runners are on UTC,
  // where a parse that forgot its `Z` reads midnight as midnight UTC and every case below agrees with it. Tokyo is the
  // day ahead, so a local parse lands on the 30th's afternoon in UTC and fails here on any host. Node reads `TZ` at
  // the moment a date is made, so the change applies to this file alone and is put back after it.
  const hostZone = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = 'Asia/Tokyo';
  });
  afterAll(() => {
    if (hostZone === undefined) delete process.env.TZ;
    else process.env.TZ = hostZone;
  });

  it('is midnight UTC of the date, whatever zone the date was determined in', () => {
    expect(calendarDay({ date: '2025-12-31', timezone: 'America/Los_Angeles' }).toISOString()).toBe(
      '2025-12-31T00:00:00.000Z',
    );
  });

  it('comes back out as the same day through the `calendar` format, whatever zone is configured', () => {
    // Configured west of UTC, where midnight UTC is still the day before — so this bites on any host.
    const west = createFormatter({ locale: 'en', formats, timeZone: 'America/Los_Angeles' });
    const day = calendarDay({ date: '2025-12-31', timezone: 'Europe/Chisinau' });

    // The hazard: a format naming no zone takes the configured one and prints the 30th.
    expect(west.dateTime(day, 'long')).toBe('December 30, 2025');
    // The pair: `calendar` names its own zone, which outranks the configured one.
    expect(west.dateTime(day, 'calendar')).toBe('December 31, 2025');
  });

  it('formats a period as the bar does — a range, its shared year said once', () => {
    const west = createFormatter({ locale: 'en', formats, timeZone: 'America/Los_Angeles' });

    const range = west.dateTimeRange(
      calendarDay({ date: '2025-01-01', timezone: 'Europe/Chisinau' }),
      calendarDay({ date: '2025-12-31', timezone: 'Europe/Chisinau' }),
      'calendar',
    );

    // ICU sets the dash between thin spaces; the words and the day are the subject, not the spacing.
    expect(range.replace(/\s/gu, ' ')).toBe('January 1 – December 31, 2025');
  });
});
