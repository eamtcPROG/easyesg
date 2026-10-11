/**
 * `@easyesg/xlsx-patch` — the official EFRAG VSME Digital Template, patched rather than regenerated (AD-10, FR-50).
 *
 * The surface is what the export needs and nothing it does not: write values into a template's own cells, and read a
 * part of a workbook back. The zip codec and the XML splicing under them are the package's own business.
 */
export { CELL_TARGET, type CellTarget, type CellTargetKind } from './cell-target.js';
export { PATCH_REFUSAL, type PatchRefusal, XlsxPatchRefusedError } from './patch-refusal.js';
export { type CellWrite, type PatchWorkbookCommand, patchWorkbook } from './patch-workbook.js';
export { readPart } from './read-part.js';
export { CELL_VALUE_KIND, type CellValue, type CellValueKind } from './workbook/cell-value.js';
