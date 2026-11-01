import { describe, expect, it } from 'vitest';
import { cellOfText, cellOfWorkbook, type WorkbookValue } from './sheet-cells';

/** As the reader edits a number in Romanian — the comma for the decimal, no thousands mark (task 220). */
const inRomanian = (decimal: string) => decimal.replace('.', ',');
const cell = (value: WorkbookValue) => cellOfWorkbook({ value, writeNumber: inRomanian });

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
    expect(cell({ numberText: '1700.5' })).toBe('1700,5');
    expect(cell({ numberText: '1.5E-3' })).toBe('0,0015');
    // A number cell never reads two ways: 1.234 is written as the reader edits it, not as `1.234` (task 220).
    expect(cell({ numberText: '1.234' })).toBe('1,234');
  });

  it('keeps a stored text it cannot read as a number, for the figure reader to refuse', () => {
    expect(cell({ numberText: 'NaN' })).toBe('NaN');
  });

  it('reads text as text, and a blank one as empty', () => {
    expect(cell('Electricitate')).toBe('Electricitate');
    expect(cell('  ')).toBeNull();
    expect(cell(null)).toBeNull();
  });

  it('reads a date as its calendar day and a true/false as its word — neither a figure', () => {
    expect(cell(new Date(Date.UTC(2025, 0, 31)))).toBe('2025-01-31');
    expect(cell(true)).toBe('true');
  });
});
