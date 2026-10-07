import { describe, expect, it } from 'vitest';
import { cellOfText, cellOfWorkbook } from './sheet-cells';

describe('cellOfText — a .csv field', () => {
  it('is its trimmed text, and empty when nothing but spaces is left', () => {
    expect(cellOfText(' Gaz natural ')).toBe('Gaz natural');
    expect(cellOfText('1 700,5')).toBe('1 700,5');
    expect(cellOfText('')).toBeNull();
    expect(cellOfText('   ')).toBeNull();
  });
});

describe('cellOfWorkbook — an .xlsx cell', () => {
  it('reads a number by its stored text, as the decimal it spells', () => {
    expect(cellOfWorkbook({ numberText: '1700.5' })).toBe('1700.5');
    expect(cellOfWorkbook({ numberText: '1.5E-3' })).toBe('0.0015');
  });

  it('keeps a stored text it cannot read as a number, for the figure reader to refuse', () => {
    expect(cellOfWorkbook({ numberText: 'NaN' })).toBe('NaN');
  });

  it('reads text as text, and a blank one as empty', () => {
    expect(cellOfWorkbook('Electricitate')).toBe('Electricitate');
    expect(cellOfWorkbook('  ')).toBeNull();
    expect(cellOfWorkbook(null)).toBeNull();
  });

  it('reads a date as its calendar day and a true/false as its word — neither a figure', () => {
    expect(cellOfWorkbook(new Date(Date.UTC(2025, 0, 31)))).toBe('2025-01-31');
    expect(cellOfWorkbook(true)).toBe('true');
  });
});
