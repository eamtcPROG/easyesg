import { monthsTotal } from './monthly-quantities';

const twelve = (entered: Readonly<Record<number, string>>): (string | null)[] =>
  Array.from({ length: 12 }, (_, index) => entered[index] ?? null);

describe('monthsTotal (task 39.1)', () => {
  it('sums twelve months exactly, with no float noise', () => {
    // 0.1 + 0.2 is 0.30000000000000004 as floats.
    expect(monthsTotal(twelve({ 0: '0.1', 1: '0.2' }))).toBe('0.3');
    expect(monthsTotal(Array.from({ length: 12 }, () => '41.6'))).toBe('499.2');
  });

  it('adds the months entered and passes over an empty one, which is flagged rather than counted as zero', () => {
    expect(monthsTotal(twelve({ 0: '40', 1: '45', 3: '38' }))).toBe('123');
  });

  it('answers no total where no month holds a figure — a line with no figure, never zero', () => {
    expect(monthsTotal(twelve({}))).toBeNull();
  });

  it('keeps a month of zero, which is an answer someone gave', () => {
    expect(monthsTotal(twelve({ 5: '0' }))).toBe('0');
  });
});
