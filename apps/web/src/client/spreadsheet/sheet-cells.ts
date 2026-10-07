import { decimalOfNumberText } from './number-text';

/**
 * One shape for a sheet, whichever file it came from (task 204.2; FR-211): rows of cells, each a cell's text or
 * `null` for an empty one. An `.xlsx` and a `.csv` reach the import alike, so nothing past `read-spreadsheet.ts` asks
 * which it was.
 *
 * **Text, because everything the import does with a cell is read it as text**: match it to a source, a unit or a
 * site, or read it as a figure the way a typed one is read. A number cell becomes the decimal its stored text spells
 * (`number-text.ts`), so `1700.5` in a workbook and `1700,5` in a semicolon `.csv` arrive as figures the same reader
 * takes. A date or a true/false cell becomes text no figure reader accepts, which is the answer for a figure column
 * holding one. A cell holding only spaces is empty — `read-excel-file` trims, and a `.csv` is trimmed here to match.
 */
export type SheetCell = string | null;
export type SheetRow = readonly SheetCell[];

export interface Sheet {
  /** The workbook's name for it, or `null` for a `.csv`, which is one unnamed sheet. */
  readonly name: string | null;
  /** By position: the row at index `i` is the sheet's row `i + 1`, empty rows included. */
  readonly rows: readonly SheetRow[];
}

/** A number cell as `read-excel-file` hands it over when `parseNumber` keeps its stored text. */
export interface NumberText {
  readonly numberText: string;
}

const textCell = (text: string): SheetCell => {
  const trimmed = text.trim();
  return trimmed === '' ? null : trimmed;
};

/** A `.csv` field: always text. */
export const cellOfText = (field: string): SheetCell => textCell(field);

/** An `.xlsx` cell, in each of the shapes the reader answers. */
export function cellOfWorkbook(value: string | boolean | Date | NumberText | null): SheetCell {
  if (value === null) return null;
  if (typeof value === 'string') return textCell(value);
  if (typeof value === 'boolean') return String(value);
  // The calendar day the cell shows; the reader builds it at midnight UTC.
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return decimalOfNumberText(value.numberText) ?? value.numberText;
}
