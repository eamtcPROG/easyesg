/**
 * Why a patch was refused — the package's one closed set of refusals (FR-50, AD-10).
 *
 * **The package refuses rather than guesses, at every layer.** A workbook it cannot reproduce byte for byte, a name it
 * cannot resolve to cells, a cell the template computes, a value Excel would silently alter: each is a refusal with a
 * reason, never a best effort. The export (task 46.1) records a refusal as the export's failure, where an operator
 * reads it; a best effort would have produced a file that opens and is wrong.
 *
 * The messages are for that operator and for a developer, and are English. Nothing here reaches a reporter as it
 * stands — the export's own failure wording is the catalogues' (OQ-43).
 */
export const PATCH_REFUSAL = {
  /** The archive uses a zip feature the codec does not reproduce: zip64, encryption, spanning, a prefix or a gap. */
  UNSUPPORTED_ARCHIVE: 'unsupported_archive',
  /** The workbook lacks a part or an element the patch needs — its root relationship, its sheets, its `calcPr`. */
  UNSUPPORTED_WORKBOOK: 'unsupported_workbook',
  /** No workbook-scoped defined name is spelled so. */
  UNKNOWN_NAME: 'unknown_name',
  /** The defined name exists and does not resolve to one rectangle of cells on one sheet — EFRAG's `#REF!` names. */
  UNRESOLVABLE_NAME: 'unresolvable_name',
  /** No sheet is named so. */
  UNKNOWN_SHEET: 'unknown_sheet',
  /** The address is not an A1 cell reference, or the offset falls outside the named range. */
  OUTSIDE_RANGE: 'outside_range',
  /** One patch writes the same cell twice, and which value wins would be an accident of order. */
  DUPLICATE_WRITE: 'duplicate_write',
  /** The sheet's XML holds no element for the cell — never, for a named cell of a registered template (the census spec). */
  MISSING_CELL: 'missing_cell',
  /** The cell holds a formula. The template computes it, and its checks read it (182/32). */
  FORMULA_CELL: 'formula_cell',
  /** The cell lies inside a merged range and is not its first cell, so a value written there is never shown. */
  MERGED_CELL: 'merged_cell',
  /** Not a plain decimal, or more significant digits than an IEEE double holds — Excel would round it silently. */
  MALFORMED_NUMBER: 'malformed_number',
  /** Text that is not well-formed UTF-16, or longer than the 32,767 characters a cell holds. */
  MALFORMED_TEXT: 'malformed_text',
} as const;
export type PatchRefusal = (typeof PATCH_REFUSAL)[keyof typeof PATCH_REFUSAL];

/** A patch the package will not make, with the reason as a member of {@link PATCH_REFUSAL}. */
export class XlsxPatchRefusedError extends Error {
  readonly refusal: PatchRefusal;

  constructor(refusal: PatchRefusal, message: string) {
    super(message);
    this.name = 'XlsxPatchRefusedError';
    this.refusal = refusal;
  }
}
