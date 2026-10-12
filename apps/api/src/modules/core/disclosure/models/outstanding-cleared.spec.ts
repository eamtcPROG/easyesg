import { outstandingCleared } from './outstanding-cleared';

const RAN = new Date('2026-10-09T04:00:00Z');
const AFTER = new Date('2026-10-09T09:00:00Z');
const BEFORE = new Date('2026-10-08T09:00:00Z');
const address = (elementKey: string, ordinal = 0) => ({ elementKey, dimensionKey: '', ordinal });

describe('outstandingCleared (task 51.2)', () => {
  const listed = [address('Turnover'), address('AddressOfSite', 1)];

  it('clears once every listed field holds an answer given since the run', () => {
    expect(
      outstandingCleared({
        listed,
        answers: [
          { value: { elementKey: 'Turnover', valueNumeric: '1200000' }, updatedAt: AFTER },
          { value: { elementKey: 'AddressOfSite', ordinal: 1, valueText: 'str. Ismail 45' }, updatedAt: AFTER },
        ],
        ranAt: RAN,
        inScope: null,
      }),
    ).toBe(true);
  });

  it('counts a field declared not available as answered', () => {
    expect(
      outstandingCleared({
        listed: [address('Turnover')],
        answers: [{ value: { elementKey: 'Turnover', state: 'not_available' }, updatedAt: AFTER }],
        ranAt: RAN,
        inScope: null,
      }),
    ).toBe(true);
  });

  it('does not clear while one listed field is still unanswered, or answered at another row', () => {
    expect(
      outstandingCleared({
        listed,
        answers: [
          { value: { elementKey: 'Turnover', valueNumeric: '1200000' }, updatedAt: AFTER },
          { value: { elementKey: 'AddressOfSite', ordinal: 0, valueText: 'str. Ismail 45' }, updatedAt: AFTER },
        ],
        ranAt: RAN,
        inScope: null,
      }),
    ).toBe(false);
  });

  it('does not clear a field answered before the run — a finding on it was about that answer', () => {
    expect(
      outstandingCleared({
        listed: [address('NumberOfEmployeesForCountryOfEmploymentContract')],
        answers: [{ value: { elementKey: 'NumberOfEmployeesForCountryOfEmploymentContract', valueNumeric: '12' }, updatedAt: BEFORE }],
        ranAt: RAN,
        inScope: null,
      }),
    ).toBe(false);
  });

  it('does not count a row emptied since the run as an answer', () => {
    expect(
      outstandingCleared({
        listed: [address('Turnover')],
        answers: [{ value: { elementKey: 'Turnover', valueNumeric: null }, updatedAt: AFTER }],
        ranAt: RAN,
        inScope: null,
      }),
    ).toBe(false);
  });

  it('clears a field that has left the scope, as a section declared omitted takes it out', () => {
    expect(
      outstandingCleared({
        listed,
        answers: [{ value: { elementKey: 'Turnover', valueNumeric: '1200000' }, updatedAt: AFTER }],
        ranAt: RAN,
        inScope: new Set(['Turnover']),
      }),
    ).toBe(true);
  });

  it('keeps the entity’s IDNO listed through every disclosure write — the next check is its backstop (task 210)', () => {
    // The record answers it, never a disclosure row, so no write can be what cleared it (§12.5.6's task-210 row (i)).
    expect(
      outstandingCleared({
        listed: [address('Turnover'), address('entity:idno')],
        answers: [{ value: { elementKey: 'Turnover', valueNumeric: '1200000' }, updatedAt: AFTER }],
        ranAt: RAN,
        inScope: null,
      }),
    ).toBe(false);
  });

  it('clears nothing when the run listed nothing', () => {
    expect(outstandingCleared({ listed: [], answers: [], ranAt: RAN, inScope: null })).toBe(false);
  });
});
