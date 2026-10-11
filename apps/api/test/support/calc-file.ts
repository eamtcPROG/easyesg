import { execFile } from 'node:child_process';
import { chmod, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const REPOSITORY = resolve(__dirname, '../../../..');
const FILE = 'workbook';

/** What LibreOffice Calc made of a workbook it opened with its defaults (task 46.2): each sheet's values, and its re-save. */
export interface CalcReading {
  /** Every sheet's values as Calc shows them once the file is open, by sheet name — rows of cells, as text. */
  readonly sheets: ReadonlyMap<string, readonly (readonly string[])[]>;
  /** The workbook as Calc saves it again. */
  readonly roundTrip: Uint8Array;
}

/**
 * Opens a workbook in the test stack's LibreOffice Calc (`infra/compose/calc`) and reads back what it made of it —
 * NFR-20's automated gate. **With Calc's own defaults**: an export names the platform as its writer, so Calc computes
 * the template's formulas on load exactly as a reader's would (§12.5.6's task-46 row (4)), and a formula's result read
 * here is the one that reader sees.
 *
 * The directory is opened to every user because the container's LibreOffice writes its outputs into it as itself, which
 * a runner's own user does not match.
 */
export async function openInCalc(workbook: Uint8Array): Promise<CalcReading> {
  const directory = await mkdtemp(join(tmpdir(), 'easyesg-calc-'));
  try {
    await chmod(directory, 0o777);
    await writeFile(join(directory, `${FILE}.xlsx`), workbook);
    await run(
      'docker',
      [
        'compose',
        '-f',
        join(REPOSITORY, 'infra/compose/docker-compose.test.yml'),
        '--env-file',
        join(REPOSITORY, 'infra/compose/.env'),
        '--env-file',
        join(REPOSITORY, 'apps/api/.env.test'),
        'run',
        '--rm',
        '-v',
        `${directory}:/data`,
        'calc',
        `/data/${FILE}.xlsx`,
      ],
      { maxBuffer: 64 * 1024 * 1024 },
    );
    const out = join(directory, 'out');
    const sheets = new Map<string, string[][]>();
    for (const name of await readdir(out)) {
      if (!name.startsWith(`${FILE}-`) || !name.endsWith('.csv')) continue;
      sheets.set(name.slice(FILE.length + 1, -'.csv'.length), parseCsv(await readFile(join(out, name), 'utf8')));
    }
    return { sheets, roundTrip: new Uint8Array(await readFile(join(out, 'round-trip', `${FILE}.xlsx`))) };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

/** One cell of a sheet Calc read, by its A1 address — `''` for a cell it showed empty. */
export function cellOf(reading: CalcReading, sheet: string, address: string): string {
  const rows = reading.sheets.get(sheet);
  if (rows === undefined) throw new Error(`Calc read no sheet ${sheet}`);
  const match = /^([A-Z]+)(\d+)$/.exec(address);
  if (match === null) throw new Error(`${address} is not a cell`);
  const column = [...match[1]].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
  return rows[Number(match[2]) - 1]?.[column] ?? '';
}

/** RFC 4180 as LibreOffice writes it: commas, double quotes doubled, line breaks inside quoted fields. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length > 0) rows.push([...row, field]);
  return rows;
}
