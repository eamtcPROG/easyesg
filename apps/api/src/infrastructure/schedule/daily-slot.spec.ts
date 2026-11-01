import { isDailySlot, openSlot, slotMinutes } from './daily-slot';

const CHISINAU = 'Europe/Chisinau';
const SEVEN = { at: '07:00', timezone: CHISINAU };

describe('slotMinutes', () => {
  it('reads a 24-hour wall-clock time', () => {
    expect(slotMinutes('07:00')).toBe(420);
    expect(slotMinutes('00:00')).toBe(0);
    expect(slotMinutes('23:59')).toBe(1439);
  });

  it.each(['7:00', '24:00', '07:60', '07:00:00', '', 'seven'])('refuses %j', (at) => {
    expect(slotMinutes(at)).toBeNull();
  });
});

describe('isDailySlot', () => {
  it('admits a well-formed time in a known zone, and nothing else', () => {
    expect(isDailySlot(SEVEN)).toBe(true);
    expect(isDailySlot({ at: '7am', timezone: CHISINAU })).toBe(false);
    expect(isDailySlot({ at: '07:00', timezone: 'Europe/Nowhere' })).toBe(false);
  });
});

describe('openSlot', () => {
  it('is closed before the time on the zone’s wall clock, and open from it until midnight', () => {
    // Chișinău is UTC+3 in summer: 03:59 UTC is 06:59 there.
    expect(openSlot({ slot: SEVEN, now: new Date('2026-07-15T03:59:00Z') })).toBeNull();
    expect(openSlot({ slot: SEVEN, now: new Date('2026-07-15T04:00:00Z') })).toBe('2026-07-15');
    expect(openSlot({ slot: SEVEN, now: new Date('2026-07-15T20:59:00Z') })).toBe('2026-07-15');
  });

  it('follows the zone across the change of offset rather than holding an hour of UTC', () => {
    // UTC+2 in winter: 07:00 there is 05:00 UTC, so 04:30 UTC is still before the slot.
    expect(openSlot({ slot: SEVEN, now: new Date('2026-12-15T04:30:00Z') })).toBeNull();
    expect(openSlot({ slot: SEVEN, now: new Date('2026-12-15T05:00:00Z') })).toBe('2026-12-15');
  });

  it('names the zone’s day, not UTC’s, after midnight there', () => {
    // 22:30 UTC on the 15th is 01:30 on the 16th in Chișinău — before the slot, so no day is open yet.
    expect(openSlot({ slot: SEVEN, now: new Date('2026-07-15T22:30:00Z') })).toBeNull();
    // An 01:00 slot is open then, for the 16th.
    expect(openSlot({ slot: { at: '01:00', timezone: CHISINAU }, now: new Date('2026-07-15T22:30:00Z') })).toBe(
      '2026-07-16',
    );
  });

  it('opens nothing for a malformed time', () => {
    expect(openSlot({ slot: { at: '7:00', timezone: CHISINAU }, now: new Date('2026-07-15T12:00:00Z') })).toBeNull();
  });
});
