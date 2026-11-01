import { readSeatAllowance, withinSeatAllowance } from './seat-ceiling';

describe('the seat allowance payload (task 142)', () => {
  it('reads a whole number of seats', () => {
    expect(readSeatAllowance({ seats: 10 })).toBe(10);
    expect(readSeatAllowance({ seats: 1 })).toBe(1);
  });

  /**
   * Every one of these is **malformed rather than strict**, and the first is the one that reads as a
   * setting: zero would refuse every invitation while looking deliberate, and a founding under it
   * would put the founder over their own ceiling.
   */
  it.each([
    ['zero', { seats: 0 }],
    ['a negative number', { seats: -3 }],
    ['a fraction', { seats: 2.5 }],
    ['a numeric string', { seats: '10' }],
    ['infinity', { seats: Number.POSITIVE_INFINITY }],
    ['NaN', { seats: Number.NaN }],
    ['a missing field', {}],
    ['a misspelled field', { seat: 10 }],
  ])('refuses %s', (_label, payload) => {
    expect(readSeatAllowance(payload)).toBeNull();
  });
});

describe('the seat ceiling (task 142)', () => {
  it('admits the write that takes the last seat', () => {
    expect(withinSeatAllowance({ allowance: 10, held: 10 })).toBe(true);
  });

  it('refuses the write that takes one past it', () => {
    expect(withinSeatAllowance({ allowance: 10, held: 11 })).toBe(false);
  });

  /**
   * The acceptance case, stated as the arithmetic it is: an invitation held a seat before it was
   * accepted and a member holds it after, so a full organization's count does not move and the
   * acceptance passes. Written out because `held + 1 <= allowance` — the natural first draft —
   * refuses exactly this.
   */
  it('admits an acceptance at a full organization, whose count the acceptance does not move', () => {
    const beforeAcceptance = 10;
    const afterAcceptance = beforeAcceptance - 1 + 1;
    expect(withinSeatAllowance({ allowance: 10, held: afterAcceptance })).toBe(true);
  });
});
