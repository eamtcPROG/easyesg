import { RevisionReadings } from './revision-readings';

describe('RevisionReadings', () => {
  it('reads a revision once, and again only when the item’s revision moves', () => {
    const read = jest.fn((payload: unknown) => payload as string);
    const readings = new RevisionReadings(read);

    expect(readings.item({ key: 'a', revision: 1, payload: 'first' })).toBe('first');
    expect(readings.item({ key: 'a', revision: 1, payload: 'first' })).toBe('first');
    expect(read).toHaveBeenCalledTimes(1);

    expect(readings.item({ key: 'a', revision: 2, payload: 'second' })).toBe('second');
    expect(readings.item({ key: 'b', revision: 1, payload: 'other' })).toBe('other');
    expect(read).toHaveBeenCalledTimes(3);
  });

  it('keeps a refusal as it keeps a reading', () => {
    const read = jest.fn(() => null);
    const readings = new RevisionReadings(read);
    readings.item({ key: 'a', revision: 1, payload: {} });
    expect(readings.item({ key: 'a', revision: 1, payload: {} })).toBeNull();
    expect(read).toHaveBeenCalledTimes(1);
  });
});
