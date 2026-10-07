import type { SheetRow } from '@/client/spreadsheet/sheet-cells';
import { holdsWords, matchText } from './import-text';

/**
 * Which column of the sheet holds what a line needs (task 204.2; FR-211; `architecture.md` §12.5.6's task-204 row
 * (2)): the sheet read as a table — its column names and the rows below them — and the column proposed for each field
 * from those names.
 *
 * **The first row that holds anything names the columns**, and every later row that holds anything is a row to
 * import, numbered by its position in the file — so a sheet that starts with a blank row still has its names read,
 * and the numbers a reporter is shown are the ones their spreadsheet shows. A row with nothing in it is not a row
 * (FR-211's behaviour 5).
 *
 * **A proposal, never a decision.** A field is proposed the first column, left to right, whose name holds one of the
 * words the catalogue lists for it, as whole words; each column is proposed once, the fields asked in the panel's
 * order. The site is asked only of a report holding more than one, so with one it is never proposed.
 */
export const IMPORT_FIELD = {
  SOURCE: 'source',
  FIGURE: 'figure',
  UNIT: 'unit',
  SITE: 'site',
  DESCRIPTION: 'description',
} as const;
export type ImportField = (typeof IMPORT_FIELD)[keyof typeof IMPORT_FIELD];

/** In the order the panel asks, which is the order a proposal takes columns in. */
export const IMPORT_FIELDS: readonly ImportField[] = Object.values(IMPORT_FIELD);

/** A column index for each field, or `null` where the file has no such column. */
export type ColumnChoice = Readonly<Record<ImportField, number | null>>;

export interface ImportRow {
  /** Its row number in the file — the position the spreadsheet shows, from 1. */
  readonly number: number;
  readonly cells: SheetRow;
}

export interface ImportTable {
  /** Each column's name, `''` where the naming row leaves it blank — as wide as the widest row. */
  readonly headers: readonly string[];
  readonly rows: readonly ImportRow[];
}

const holdsAnything = (row: SheetRow) => row.some((cell) => cell !== null);

export function tableOf(rows: readonly SheetRow[]): ImportTable | null {
  const named = rows.findIndex(holdsAnything);
  if (named === -1) return null;
  const width = Math.max(...rows.map((row) => row.length));
  return {
    headers: Array.from({ length: width }, (_, column) => rows[named][column] ?? ''),
    rows: rows.flatMap((cells, index) => (index > named && holdsAnything(cells) ? [{ number: index + 1, cells }] : [])),
  };
}

/** The cell a row holds in a field's column, or `null` where the field has none or the cell is empty. */
export const cellIn = (input: { readonly row: ImportRow; readonly column: number | null }): string | null =>
  input.column === null ? null : (input.row.cells[input.column] ?? null);

export function proposeColumns(input: {
  readonly headers: readonly string[];
  /** The words each field is known by, as `wordsOf` reads the catalogue's list. */
  readonly words: Readonly<Record<ImportField, readonly string[]>>;
  /** How many sites the report holds: one, and no column is asked for. */
  readonly sites: number;
}): ColumnChoice {
  const names = input.headers.map(matchText);
  const taken = new Set<number>();
  const propose = (field: ImportField): number | null => {
    if (field === IMPORT_FIELD.SITE && input.sites <= 1) return null;
    const column = names.findIndex(
      (name, index) => !taken.has(index) && input.words[field].some((phrase) => holdsWords({ text: name, phrase })),
    );
    if (column === -1) return null;
    taken.add(column);
    return column;
  };
  // Written in `IMPORT_FIELDS`' order, which is the order the members are evaluated in, and so the order the fields
  // take their columns.
  return {
    [IMPORT_FIELD.SOURCE]: propose(IMPORT_FIELD.SOURCE),
    [IMPORT_FIELD.FIGURE]: propose(IMPORT_FIELD.FIGURE),
    [IMPORT_FIELD.UNIT]: propose(IMPORT_FIELD.UNIT),
    [IMPORT_FIELD.SITE]: propose(IMPORT_FIELD.SITE),
    [IMPORT_FIELD.DESCRIPTION]: propose(IMPORT_FIELD.DESCRIPTION),
  };
}

/** The fields a line cannot be made without, given how many sites the report holds. */
export const requiredFields = (sites: number): readonly ImportField[] =>
  sites > 1 ? [IMPORT_FIELD.SOURCE, IMPORT_FIELD.FIGURE, IMPORT_FIELD.SITE] : [IMPORT_FIELD.SOURCE, IMPORT_FIELD.FIGURE];
