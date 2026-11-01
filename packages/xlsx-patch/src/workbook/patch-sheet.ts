import { PATCH_REFUSAL, XlsxPatchRefusedError } from '../patch-refusal.js';
import { type CellPosition, type CellRange, formatCell, parseRange, rangeContains } from './cell-reference.js';
import { type CellValue, cellBody } from './cell-value.js';
import { attributeOf, readAttributes, startTags } from './xml-text.js';

/** One cell a sheet patch writes. */
export interface SheetWrite {
  readonly cell: CellPosition;
  readonly value: CellValue;
}

/**
 * Attributes a written cell does not keep: `t` names the old value's type, `cm` and `vm` its cell and value metadata
 * (a dynamic array, a rich value) — all three described the value being replaced. `r`, `s` and anything else stay,
 * written exactly as they were, so the cell keeps its place and its formatting.
 */
const DROPPED_ATTRIBUTES = new Set(['t', 'cm', 'vm']);
const FORMULA = /<f[\s/>]/;
/** A cell's start tag. `(?=…)` is what keeps `<cfRule`, `<col` and `<charset` out — none of them is a cell. */
const CELL_START = /<c(?=[\s/>])[^>]*>/;

/**
 * A worksheet's XML with each written cell's element replaced, and every other byte of it as it was.
 *
 * **It writes only into a cell the template already holds.** Every cell a resolvable defined name covers exists as an
 * element in the registered templates — the template's styled, empty input; `patch-workbook.spec.ts`'s census holds it
 * — so inserting a cell or a row is machinery the templates never need, and a missing one is refused as a sign the
 * workbook is not the template it was taken for.
 *
 * **Three refusals keep the template's own behaviour intact**: a cell holding a formula, because the template computes
 * it and its checks read it (182/32); a cell inside a merge but not its first, because nothing written there is ever
 * shown; and a sheet with no cell data at all.
 */
export function patchSheet(command: { readonly sheet: string; readonly xml: string; readonly writes: readonly SheetWrite[] }): string {
  const { sheet, xml, writes } = command;
  const open = startTags(xml, 'sheetData')[0];
  if (open === undefined || open.tag.endsWith('/>')) {
    throw new XlsxPatchRefusedError(PATCH_REFUSAL.MISSING_CELL, `${sheet} holds no cell data`);
  }
  const dataStart = open.index + open.tag.length;
  const dataEnd = xml.indexOf('</sheetData>', dataStart);

  const merges = startTags(xml, 'mergeCell')
    .map(({ tag }) => parseRange(attributeOf(tag, 'ref') ?? ''))
    .filter((range): range is CellRange => range !== null);
  for (const { cell } of writes) {
    const merge = merges.find((range) => rangeContains(range, cell));
    if (merge !== undefined && (merge.start.column !== cell.column || merge.start.row !== cell.row)) {
      throw new XlsxPatchRefusedError(
        PATCH_REFUSAL.MERGED_CELL,
        `${sheet}!${formatCell(cell)} lies inside the merge from ${formatCell(merge.start)} and is never shown`,
      );
    }
  }

  const wanted = new Map(writes.map((write) => [formatCell(write.cell), write]));
  const splices: { start: number; end: number; text: string }[] = [];
  const cellStart = new RegExp(CELL_START.source, 'g');
  cellStart.lastIndex = dataStart;
  for (let match = cellStart.exec(xml); match !== null && match.index < dataEnd; match = cellStart.exec(xml)) {
    const startTag = match[0];
    const reference = attributeOf(startTag, 'r');
    if (reference === null) continue;
    const write = wanted.get(reference);
    if (write === undefined) continue;

    const selfClosing = startTag.endsWith('/>');
    const close = selfClosing ? -1 : xml.indexOf('</c>', match.index);
    if (!selfClosing && (close === -1 || close > dataEnd)) {
      throw new XlsxPatchRefusedError(PATCH_REFUSAL.UNSUPPORTED_WORKBOOK, `${sheet}!${reference} is never closed`);
    }
    const end = selfClosing ? match.index + startTag.length : close + '</c>'.length;
    if (!selfClosing && FORMULA.test(xml.slice(match.index + startTag.length, end))) {
      throw new XlsxPatchRefusedError(PATCH_REFUSAL.FORMULA_CELL, `${sheet}!${reference} holds a formula`);
    }
    splices.push({ start: match.index, end, text: writtenCell(startTag, write.value) });
    wanted.delete(reference);
  }

  const missing = [...wanted.keys()];
  if (missing.length > 0) {
    throw new XlsxPatchRefusedError(PATCH_REFUSAL.MISSING_CELL, `${sheet} holds no element for ${missing.join(', ')}`);
  }

  return splices
    .sort((a, b) => b.start - a.start)
    .reduce((text, splice) => text.slice(0, splice.start) + splice.text + text.slice(splice.end), xml);
}

/** The cell's start tag kept but for the attributes that described the old value, then the new value's body. */
function writtenCell(startTag: string, value: CellValue): string {
  const kept = readAttributes(startTag)
    .filter((attribute) => !DROPPED_ATTRIBUTES.has(attribute.name))
    .map((attribute) => ` ${attribute.raw}`)
    .join('');
  const body = cellBody(value);
  return `<c${kept}${body.type === null ? '' : ` t="${body.type}"`}>${body.children}</c>`;
}
