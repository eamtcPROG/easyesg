import { describe, expect, it } from 'vitest';
import { formatCell, parseCell, parseRange, rangeContains } from './cell-reference.js';

describe('A1 cell references', () => {
  it('reads a cell, absolute or relative, counting from 1', () => {
    expect(parseCell('E282')).toEqual({ column: 5, row: 282 });
    expect(parseCell('$E$282')).toEqual({ column: 5, row: 282 });
    expect(parseCell('AA1')).toEqual({ column: 27, row: 1 });
    expect(parseCell('XFD1048576')).toEqual({ column: 16_384, row: 1_048_576 });
  });

  it('refuses what is not one cell inside Excel’s bounds', () => {
    for (const reference of ['', 'E', '282', 'E0', 'e282', 'XFE1', 'A1048577', 'E282:E283', '#REF!']) {
      expect(parseCell(reference)).toBeNull();
    }
  });

  it('writes a position back as a cell’s r attribute spells it', () => {
    for (const reference of ['A1', 'Z9', 'AA10', 'AZ1', 'BA1', 'ZZ2', 'AAA3', 'XFD1048576']) {
      const position = parseCell(reference);
      expect(position === null ? null : formatCell(position)).toBe(reference);
    }
  });

  it('reads a range, and a lone cell as a range of one', () => {
    expect(parseRange('$D$406:$D$505')).toEqual({ start: { column: 4, row: 406 }, end: { column: 4, row: 505 } });
    expect(parseRange('E282')).toEqual({ start: { column: 5, row: 282 }, end: { column: 5, row: 282 } });
  });

  it('refuses a range that is not top-left to bottom-right, or has a third corner', () => {
    expect(parseRange('E2:D3')).toBeNull();
    expect(parseRange('D3:E2')).toBeNull();
    expect(parseRange('A1:B2:C3')).toBeNull();
    expect(parseRange('$A:$A')).toBeNull();
  });

  it('says whether a cell lies inside a range, edges included', () => {
    const range = { start: { column: 3, row: 78 }, end: { column: 11, row: 78 } };
    expect(rangeContains(range, { column: 3, row: 78 })).toBe(true);
    expect(rangeContains(range, { column: 11, row: 78 })).toBe(true);
    expect(rangeContains(range, { column: 12, row: 78 })).toBe(false);
    expect(rangeContains(range, { column: 3, row: 79 })).toBe(false);
  });
});
