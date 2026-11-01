import { bareCode, isClass } from './nace-code';

/** Task 208: what a NACE code's characters say. No store, no classifier. */
describe('bareCode', () => {
  it('reads one code however the reader punctuated it', () => {
    expect(['10.71', '1071', '10 71', ' 10-71 '].map(bareCode)).toEqual(['1071', '1071', '1071', '1071']);
  });

  it('keeps a section’s letter, lower-cased', () => {
    expect(bareCode('C')).toBe('c');
  });
});

describe('isClass', () => {
  it('is true of the four-digit code B1 exports, however it is written', () => {
    expect(isClass('10.71')).toBe(true);
    expect(isClass('1071')).toBe(true);
  });

  it('is false of a section, a division and a group', () => {
    expect(['C', '10', '10.7'].map(isClass)).toEqual([false, false, false]);
  });
});
