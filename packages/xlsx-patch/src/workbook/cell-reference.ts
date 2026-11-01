/**
 * A1 cell references — the one notation a defined name, a cell's `r` attribute and a merge's `ref` all share.
 *
 * Columns and rows are counted from 1, as A1 counts them, so `E282` is column 5, row 282. Excel's own bounds apply —
 * XFD and row 1,048,576 — because a reference past them names a cell no sheet can hold.
 */
export interface CellPosition {
  readonly column: number;
  readonly row: number;
}

/** A rectangle of cells, inclusive at both corners: `D406:D505`, or a single cell as a range of one. */
export interface CellRange {
  readonly start: CellPosition;
  readonly end: CellPosition;
}

const MAX_COLUMN = 16_384;
const MAX_ROW = 1_048_576;
const CELL = /^\$?([A-Z]{1,3})\$?([1-9]\d*)$/;

/** `E282` or `$E$282`, or `null` for anything that is not one cell inside Excel's bounds. */
export function parseCell(reference: string): CellPosition | null {
  const match = CELL.exec(reference);
  if (!match) return null;
  const column = [...match[1]].reduce((value, letter) => value * 26 + letter.charCodeAt(0) - 64, 0);
  const row = Number(match[2]);
  return column <= MAX_COLUMN && row <= MAX_ROW ? { column, row } : null;
}

/** `{ column: 5, row: 282 }` as `E282`, the form a cell's `r` attribute takes. */
export function formatCell(position: CellPosition): string {
  let letters = '';
  for (let column = position.column; column > 0; column = Math.floor((column - 1) / 26)) {
    letters = String.fromCharCode(65 + ((column - 1) % 26)) + letters;
  }
  return `${letters}${position.row}`;
}

/** `D406:D505`, `$D$3:$E$3` or a lone `E282`; `null` unless both corners are cells and the first is the top-left. */
export function parseRange(reference: string): CellRange | null {
  const [first, second, ...rest] = reference.split(':');
  if (rest.length > 0) return null;
  const start = parseCell(first);
  const end = second === undefined ? start : parseCell(second);
  if (start === null || end === null || end.column < start.column || end.row < start.row) return null;
  return { start, end };
}

/** Whether a cell lies inside a range, edges included. */
export function rangeContains(range: CellRange, position: CellPosition): boolean {
  return (
    position.column >= range.start.column &&
    position.column <= range.end.column &&
    position.row >= range.start.row &&
    position.row <= range.end.row
  );
}
