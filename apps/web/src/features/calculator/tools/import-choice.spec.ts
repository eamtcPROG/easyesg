import { describe, expect, it } from 'vitest';
import { columnLetter, columnOfSelect, NO_CHOICE, optionOfSelect, selectValueOf } from './import-choice';

describe('the import panel’s select values', () => {
  it('carries a column or an option as text, and nothing as a member of its own — never the empty string', () => {
    expect(selectValueOf(0)).toBe('0');
    expect(selectValueOf('natural_gas')).toBe('natural_gas');
    expect(selectValueOf(null)).toBe(NO_CHOICE);
    expect(NO_CHOICE).not.toBe('');
  });

  it('reads each back as what it carried', () => {
    expect(columnOfSelect('3')).toBe(3);
    expect(columnOfSelect(selectValueOf(null))).toBeNull();
    expect(optionOfSelect('m3')).toBe('m3');
    expect(optionOfSelect(selectValueOf(null))).toBeNull();
  });
});

describe('columnLetter', () => {
  it('names a column as a spreadsheet does', () => {
    expect(columnLetter(0)).toBe('A');
    expect(columnLetter(25)).toBe('Z');
    expect(columnLetter(26)).toBe('AA');
    expect(columnLetter(27)).toBe('AB');
    expect(columnLetter(51)).toBe('AZ');
    expect(columnLetter(52)).toBe('BA');
    expect(columnLetter(701)).toBe('ZZ');
    expect(columnLetter(702)).toBe('AAA');
  });
});
