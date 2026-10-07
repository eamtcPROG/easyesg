import type { CalcFactorSource, CalcSite, WriteCalcLineRequest } from '@easyesg/contracts';
import { readFigure } from './figure-input';
import { cellIn, IMPORT_FIELD, requiredFields, type ColumnChoice, type ImportField, type ImportTable } from './import-columns';
import type { MatchedField } from './import-values';

/**
 * What an import will do with the sheet as the reporter has mapped it (task 204.2; FR-211; `architecture.md`
 * §12.5.6's task-204 row (1), (3), (4)): the lines it will add, and every row it cannot read with what is wrong — or
 * why the sheet cannot be imported at all, or which columns are still to be named.
 *
 * **One row is one line with one figure for the period**, in the sheet's own unit, at its site. **A row the api would
 * refuse is a row this reports**, and never a line — a refused write holds the queue until something changes
 * (FR-38), so one bad row would stop every line behind it. What the api checks a line against is what the calculator
 * read already serves: the factor set's sources and the units each admits, the report's sites. Checked here in the
 * same terms, plus the two lengths the api's request admits.
 *
 * **One problem per row, the first met**, in the order a reader fixes them: what the bill is for, where, the figure,
 * its unit, the description. A row with no figure is reported, not added as an explained line — why a figure is
 * missing is a person's to write (row (3)).
 *
 * **The row limit is asked of the sheet chosen**, not of the file, so a workbook whose other sheet is too long can
 * still be imported from this one. Pure, and recomputed from what was read and what was chosen, never stored.
 */
export const IMPORT_LIMITS = {
  /** The largest file read — row (4)'s 1 MB. */
  MAX_BYTES: 1_048_576,
  /** The most rows below the names — row (4). */
  MAX_ROWS: 500,
  /** The longest description a line holds — the api's own limit on a line's text. */
  LINE_TEXT: 500,
  /** The longest figure a line's request admits, as text. */
  FIGURE_TEXT: 64,
} as const;

export const IMPORT_PROBLEM = {
  SOURCE_MISSING: 'source_missing',
  SOURCE_UNMATCHED: 'source_unmatched',
  SITE_MISSING: 'site_missing',
  SITE_UNMATCHED: 'site_unmatched',
  NO_FIGURE: 'no_figure',
  NOT_A_FIGURE: 'not_a_figure',
  UNIT_MISSING: 'unit_missing',
  UNIT_UNMATCHED: 'unit_unmatched',
  UNIT_NOT_ADMITTED: 'unit_not_admitted',
  DESCRIPTION_TOO_LONG: 'description_too_long',
} as const;
export type ImportProblem = (typeof IMPORT_PROBLEM)[keyof typeof IMPORT_PROBLEM];

/** Why the sheet chosen cannot be imported at all. */
export const SHEET_REFUSAL = { NO_ROWS: 'no_rows', TOO_MANY_ROWS: 'too_many_rows' } as const;
export type SheetRefusal = (typeof SHEET_REFUSAL)[keyof typeof SHEET_REFUSAL];

export const IMPORT_PLAN = { REFUSED: 'refused', INCOMPLETE: 'incomplete', READY: 'ready' } as const;

export interface UnreadableRow {
  /** Its row number in the file. */
  readonly number: number;
  readonly problem: ImportProblem;
  /** The cell the problem is about, where there is one to quote. */
  readonly value: string | null;
}

export type ImportPlan =
  | { readonly kind: typeof IMPORT_PLAN.REFUSED; readonly refusal: SheetRefusal }
  | { readonly kind: typeof IMPORT_PLAN.INCOMPLETE; readonly missing: readonly ImportField[] }
  | {
      readonly kind: typeof IMPORT_PLAN.READY;
      readonly lines: readonly WriteCalcLineRequest[];
      readonly unreadable: readonly UnreadableRow[];
    };

type RowReading = { readonly line: WriteCalcLineRequest } | { readonly unreadable: UnreadableRow };

export function planImport(input: {
  readonly table: ImportTable | null;
  readonly columns: ColumnChoice;
  /** The option a value is matched to, as the reporter chose or the panel proposed — `null` for none. */
  readonly matched: (choice: { readonly field: MatchedField; readonly value: string }) => string | null;
  readonly sources: readonly CalcFactorSource[];
  readonly sites: readonly CalcSite[];
}): ImportPlan {
  const { table, columns, matched, sources, sites } = input;
  if (table === null || table.rows.length === 0) return { kind: IMPORT_PLAN.REFUSED, refusal: SHEET_REFUSAL.NO_ROWS };
  if (table.rows.length > IMPORT_LIMITS.MAX_ROWS) {
    return { kind: IMPORT_PLAN.REFUSED, refusal: SHEET_REFUSAL.TOO_MANY_ROWS };
  }
  const missing = requiredFields(sites.length).filter((field) => columns[field] === null);
  if (missing.length > 0) return { kind: IMPORT_PLAN.INCOMPLETE, missing };

  const readings: RowReading[] = table.rows.map((row) => {
    const cell = (field: ImportField) => cellIn({ row, column: columns[field] });
    const refuse = (problem: ImportProblem, value: string | null = null): RowReading => ({
      unreadable: { number: row.number, problem, value },
    });

    const sourceText = cell(IMPORT_FIELD.SOURCE);
    if (sourceText === null) return refuse(IMPORT_PROBLEM.SOURCE_MISSING);
    const sourceKey = matched({ field: IMPORT_FIELD.SOURCE, value: sourceText });
    const source = sources.find((each) => each.key === sourceKey);
    if (source === undefined) return refuse(IMPORT_PROBLEM.SOURCE_UNMATCHED, sourceText);

    const siteText = cell(IMPORT_FIELD.SITE);
    const onlySite = sites.length === 1 ? sites[0].ordinal : null;
    if (onlySite === null && siteText === null) return refuse(IMPORT_PROBLEM.SITE_MISSING);
    const siteChoice = onlySite === null && siteText !== null ? matched({ field: IMPORT_FIELD.SITE, value: siteText }) : null;
    const siteOrdinal = onlySite ?? sites.find((site) => String(site.ordinal) === siteChoice)?.ordinal;
    if (siteOrdinal === undefined) return refuse(IMPORT_PROBLEM.SITE_UNMATCHED, siteText);

    const figureText = cell(IMPORT_FIELD.FIGURE);
    if (figureText === null) return refuse(IMPORT_PROBLEM.NO_FIGURE);
    const figure = readFigure(figureText);
    if (!('value' in figure) || figure.value === null || figure.value.length > IMPORT_LIMITS.FIGURE_TEXT) {
      return refuse(IMPORT_PROBLEM.NOT_A_FIGURE, figureText);
    }

    const unitText = cell(IMPORT_FIELD.UNIT);
    const unitCode =
      unitText === null
        ? source.units.length === 1
          ? source.units[0]
          : null
        : matched({ field: IMPORT_FIELD.UNIT, value: unitText });
    if (unitText === null && unitCode === null) return refuse(IMPORT_PROBLEM.UNIT_MISSING);
    if (unitCode === null) return refuse(IMPORT_PROBLEM.UNIT_UNMATCHED, unitText);
    if (!source.units.includes(unitCode)) return refuse(IMPORT_PROBLEM.UNIT_NOT_ADMITTED, unitText);

    const description = cell(IMPORT_FIELD.DESCRIPTION);
    if (description !== null && description.length > IMPORT_LIMITS.LINE_TEXT) {
      return refuse(IMPORT_PROBLEM.DESCRIPTION_TOO_LONG);
    }
    return { line: { siteOrdinal, sourceKey: source.key, description, quantity: figure.value, unitCode } };
  });

  return {
    kind: IMPORT_PLAN.READY,
    lines: readings.flatMap((reading) => ('line' in reading ? [reading.line] : [])),
    unreadable: readings.flatMap((reading) => ('unreadable' in reading ? [reading.unreadable] : [])),
  };
}
