import { USAGE_STANDING } from '@easyesg/ui';
import { describe, expect, it } from 'vitest';
import { seatRegion } from './seats';

describe('seatRegion (task 142; UX-50, UX-52)', () => {
  it('is within the ceiling while more than one seat remains', () => {
    expect(seatRegion({ allowance: 10, used: 4 })).toEqual({
      standing: USAGE_STANDING.WITHIN,
      used: 4,
      limit: 10,
      remaining: 6,
    });
  });

  /** UX-52's threshold: the warning shows before the limit, when one seat is left. */
  it('approaches the ceiling with exactly one seat left', () => {
    expect(seatRegion({ allowance: 10, used: 9 }).standing).toBe(USAGE_STANDING.APPROACHING);
  });

  it('reaches it with none left', () => {
    expect(seatRegion({ allowance: 10, used: 10 })).toMatchObject({
      standing: USAGE_STANDING.REACHED,
      remaining: 0,
    });
  });

  /** An organization whose ceiling was lowered below its count: full, with nothing negative drawn. */
  it('reads an organization over its ceiling as full, with none remaining', () => {
    expect(seatRegion({ allowance: 10, used: 12 })).toMatchObject({
      standing: USAGE_STANDING.REACHED,
      remaining: 0,
    });
  });

  /** A ceiling of one is full as soon as its founder holds it, and never "approaching" first. */
  it('treats a ceiling of one held by one person as reached', () => {
    expect(seatRegion({ allowance: 1, used: 1 }).standing).toBe(USAGE_STANDING.REACHED);
  });

  it('reads an unreadable ceiling as unknown, keeping the count', () => {
    expect(seatRegion({ allowance: null, used: 4 })).toEqual({
      standing: USAGE_STANDING.UNKNOWN,
      used: 4,
    });
  });
});
