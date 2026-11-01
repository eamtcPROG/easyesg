import { ruleSetDate } from './rule-set-date';

describe('ruleSetDate', () => {
  const now = new Date('2027-03-10T09:00:00Z');

  it('reads an open period as at today', () => {
    expect(ruleSetDate({ lockedAt: null, timezone: 'Europe/Chisinau', now })).toBe('2027-03-10');
  });

  it('reads a locked period as at the day it was locked, not today', () => {
    expect(ruleSetDate({ lockedAt: new Date('2026-12-15T10:00:00Z'), timezone: 'Europe/Chisinau', now })).toBe(
      '2026-12-15',
    );
  });

  it('takes the lock day in the period’s own zone', () => {
    // 22:30 UTC on 14 December is already the 15th in Chișinău.
    expect(ruleSetDate({ lockedAt: new Date('2026-12-14T22:30:00Z'), timezone: 'Europe/Chisinau', now })).toBe(
      '2026-12-15',
    );
  });
});
