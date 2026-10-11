import { PATCH_REFUSAL, XlsxPatchRefusedError } from './patch-refusal.js';
import { type CellPosition, parseCell, rangeContains } from './workbook/cell-reference.js';
import { resolveReference } from './workbook/defined-names.js';
import type { OpenedWorkbook } from './workbook/open-workbook.js';

/** How a write names its cell. */
export const CELL_TARGET = {
  /**
   * By the template's defined name — `Assets`, `AddressOfSite` — and, inside a named range, by its row and column
   * counted from the range's first cell, from 0. The export's usual form: EFRAG names an element's cells after it.
   */
  NAMED: 'named',
  /** By sheet and A1 address — for the template's cells no name covers, such as the reporting period's day fields. */
  ADDRESS: 'address',
} as const;
export type CellTargetKind = (typeof CELL_TARGET)[keyof typeof CELL_TARGET];

export type CellTarget =
  | { readonly kind: typeof CELL_TARGET.NAMED; readonly name: string; readonly row?: number; readonly column?: number }
  | { readonly kind: typeof CELL_TARGET.ADDRESS; readonly sheet: string; readonly cell: string };

/** A target resolved to one cell of one worksheet part. */
export interface ResolvedCell {
  readonly sheet: string;
  readonly part: string;
  readonly cell: CellPosition;
}

/**
 * The cell a target names, or a refusal saying why it names none.
 *
 * **A named target with no offset is the range's first cell**, which is the whole of a single-cell name and the
 * written cell of a merged one — `template_reporting_entity_name` covers `D3:E3`, one merged field.
 */
export function resolveCellTarget(workbook: Pick<OpenedWorkbook, 'parts' | 'names'>, target: CellTarget): ResolvedCell {
  if (target.kind === CELL_TARGET.ADDRESS) {
    const cell = parseCell(target.cell);
    if (cell === null) throw new XlsxPatchRefusedError(PATCH_REFUSAL.OUTSIDE_RANGE, `${target.cell} is not a cell address`);
    return { sheet: target.sheet, part: partOf(workbook, target.sheet), cell };
  }

  const reference = workbook.names.get(target.name);
  if (reference === undefined) throw new XlsxPatchRefusedError(PATCH_REFUSAL.UNKNOWN_NAME, `no name ${target.name}`);
  const named = resolveReference(reference);
  if (named === null) {
    throw new XlsxPatchRefusedError(PATCH_REFUSAL.UNRESOLVABLE_NAME, `${target.name} refers to ${reference}, which is not a range of cells`);
  }
  const row = target.row ?? 0;
  const column = target.column ?? 0;
  const cell = { column: named.range.start.column + column, row: named.range.start.row + row };
  if (!Number.isInteger(row) || !Number.isInteger(column) || row < 0 || column < 0 || !rangeContains(named.range, cell)) {
    throw new XlsxPatchRefusedError(PATCH_REFUSAL.OUTSIDE_RANGE, `row ${row}, column ${column} lies outside ${target.name}`);
  }
  return { sheet: named.sheet, part: partOf(workbook, named.sheet), cell };
}

function partOf(workbook: Pick<OpenedWorkbook, 'parts'>, sheet: string): string {
  const part = workbook.parts.sheets.get(sheet);
  if (part === undefined) throw new XlsxPatchRefusedError(PATCH_REFUSAL.UNKNOWN_SHEET, `no worksheet ${sheet}`);
  return part;
}
