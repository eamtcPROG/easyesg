import { describe, expect, it } from 'vitest';
import { missingMonths, monthTotal } from './month-total';

const twelve = (entered: Readonly<Record<number, string>>): (string | null)[] =>
  Array.from({ length: 12 }, (_, index) => entered[index] ?? null);

describe('monthTotal (task 39.1)', () => {
  it('adds the months exactly, as the server will', () => {
    expect(monthTotal(twelve({ 0: '0.1', 1: '0.2' }))).toBe('0.3');
    expect(monthTotal(['40', '45', null, '38', '30', '22', '18', '17', '21', '33', '41', '48.5'])).toBe('353.5');
    expect(monthTotal(twelve({ 0: '1.25', 1: '0.75' }))).toBe('2');
    expect(monthTotal(twelve({ 0: '0.05', 1: '0.05' }))).toBe('0.1');
  });

  it('has no total until a month holds a figure, and keeps a month of zero', () => {
    expect(monthTotal(twelve({}))).toBeNull();
    expect(monthTotal(twelve({ 3: '0' }))).toBe('0');
  });
});

describe('missingMonths (task 39.1)', () => {
  it('names the empty months by position, and none of a full year', () => {
    expect(missingMonths(twelve({ 0: '1', 1: '2' }))).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(missingMonths(Array.from({ length: 12 }, () => '1'))).toEqual([]);
  });
});
