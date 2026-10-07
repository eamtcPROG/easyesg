import { cellOfText, cellOfWorkbook, type NumberText, type Sheet } from './sheet-cells';

/**
 * A spreadsheet the reader chose, read in the browser (task 204.2; FR-211; `architecture.md` §12.5.6's task-204 row
 * (1), (4)): an `.xlsx` with every sheet it holds, or a `.csv` as its one sheet — or why it could not be read.
 *
 * **Nothing is uploaded.** The file is read here and its rows become calculator lines through the wizard's queue,
 * like typed ones; no route takes a file. **Each reader is loaded when a file of its kind arrives**
 * (`read-excel-file`, `papaparse`; §12.1), so neither weighs on a screen nobody imports from.
 *
 * Refused whole, before either reader runs, for what the file *is*: not an `.xlsx` or `.csv` by its name, or larger
 * than the caller allows. Refused whole after, for what it *holds*: a workbook the reader cannot open, a `.csv` with
 * a quote left open. How many rows a sheet may hold is the import's question, asked of the sheet the reporter chose.
 *
 * **A reader that cannot be loaded is its own refusal.** Each is a chunk fetched from the server, so a reporter who
 * lost the connection before opening the import would otherwise be told their file is not a spreadsheet.
 * `loadSpreadsheetReaders` fetches both when the import opens, which is what lets a file chosen once the connection
 * has gone still be read: its lines then wait in the queue like any typed line (FR-38).
 *
 * **A `.csv` is UTF-8, its fields separated by semicolons, commas or tabs**, the separator guessed from the file —
 * semicolon first, because a spreadsheet saved as `.csv` where a comma is the decimal point (Romanian, Russian) writes
 * semicolons, and its figures' commas are then not mistaken for separators. A byte-order mark is not part of the
 * first column's name.
 */
export const SPREADSHEET_FORMAT = { XLSX: 'xlsx', CSV: 'csv' } as const;
export type SpreadsheetFormat = (typeof SPREADSHEET_FORMAT)[keyof typeof SPREADSHEET_FORMAT];

/** What the system dialogue offers: the two formats, by extension and by type. */
export const SPREADSHEET_ACCEPT =
  '.xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export const SPREADSHEET_REFUSAL = {
  /** Neither an `.xlsx` nor a `.csv`. */
  FORMAT: 'format',
  /** Larger than the caller allows. */
  SIZE: 'size',
  /** Named as one, and not readable as one. */
  UNREADABLE: 'unreadable',
  /** The reader itself could not be loaded — no connection when the import opened. */
  READER: 'reader',
} as const;
export type SpreadsheetRefusal = (typeof SPREADSHEET_REFUSAL)[keyof typeof SPREADSHEET_REFUSAL];

export const SPREADSHEET_OUTCOME = { READ: 'read', REFUSED: 'refused' } as const;

export type SpreadsheetRead =
  | { readonly kind: typeof SPREADSHEET_OUTCOME.READ; readonly sheets: readonly Sheet[] }
  | { readonly kind: typeof SPREADSHEET_OUTCOME.REFUSED; readonly refusal: SpreadsheetRefusal };

// `papaparse`'s own error vocabulary — the one type that means the rows cannot be trusted.
const PAPA_ERROR = { QUOTES: 'Quotes' } as const;
const CSV_SEPARATORS = [';', ',', '\t'];

const refused = (refusal: SpreadsheetRefusal): SpreadsheetRead => ({ kind: SPREADSHEET_OUTCOME.REFUSED, refusal });

export function formatOf(fileName: string): SpreadsheetFormat | null {
  const dot = fileName.lastIndexOf('.');
  if (dot === -1) return null;
  const extension = fileName.slice(dot + 1).toLowerCase();
  return Object.values(SPREADSHEET_FORMAT).find((format) => format === extension) ?? null;
}

type WorkbookCell = Parameters<typeof cellOfWorkbook>[0];

const workbookReader = () => import('read-excel-file/browser');
const csvReader = () => import('papaparse');

/** Both readers, fetched ahead of a file — called when the import opens; a failure here is answered when one is read. */
export const loadSpreadsheetReaders = (): Promise<unknown> =>
  Promise.all([workbookReader(), csvReader()]).catch(() => undefined);

async function readWorkbook(file: File): Promise<readonly Sheet[]> {
  const { default: readXlsxFile } = await workbookReader();
  const sheets = await readXlsxFile<NumberText>(file, { parseNumber: (numberText) => ({ numberText }) });
  return sheets.map((sheet) => ({
    name: sheet.sheet,
    // The one cast here, and it corrects the library's declaration rather than trusting data: 9.3.10's `CellValue`
    // says a date cell is `typeof Date`, the constructor, where `parseExcelDate` hands over `new Date(…)`.
    rows: sheet.data.map((row) => row.map((value) => cellOfWorkbook(value as WorkbookCell))),
  }));
}

async function readCsv(file: File): Promise<readonly Sheet[] | null> {
  // A byte-order mark is `papaparse`'s to drop, and it does, before either pass.
  const [{ default: Papa }, text] = await Promise.all([csvReader(), file.text()]);
  // **Guessed with the empty lines skipped, read with them kept.** `papaparse` counts an empty line as a row of one
  // field when it guesses, so a file's last line break pulled the semicolon below its threshold and the guess fell
  // back to the comma — splitting `1700,5` in two (found by this module's spec). Kept when reading, because a row's
  // number is its position in the file.
  const { delimiter } = Papa.parse<string[]>(text, { delimitersToGuess: CSV_SEPARATORS, skipEmptyLines: 'greedy' }).meta;
  const parsed = Papa.parse<string[]>(text, { delimiter, skipEmptyLines: false });
  if (parsed.errors.some((error) => error.type === PAPA_ERROR.QUOTES)) return null;
  return [{ name: null, rows: parsed.data.map((row) => row.map(cellOfText)) }];
}

export async function readSpreadsheet(input: { readonly file: File; readonly maxBytes: number }): Promise<SpreadsheetRead> {
  const format = formatOf(input.file.name);
  if (format === null) return refused(SPREADSHEET_REFUSAL.FORMAT);
  if (input.file.size > input.maxBytes) return refused(SPREADSHEET_REFUSAL.SIZE);
  try {
    await (format === SPREADSHEET_FORMAT.XLSX ? workbookReader() : csvReader());
  } catch {
    return refused(SPREADSHEET_REFUSAL.READER);
  }
  try {
    const sheets = format === SPREADSHEET_FORMAT.XLSX ? await readWorkbook(input.file) : await readCsv(input.file);
    return sheets === null ? refused(SPREADSHEET_REFUSAL.UNREADABLE) : { kind: SPREADSHEET_OUTCOME.READ, sheets };
  } catch {
    // The reader's own errors — not a zip, not a workbook, a sheet it cannot parse — all say the same thing here.
    return refused(SPREADSHEET_REFUSAL.UNREADABLE);
  }
}
