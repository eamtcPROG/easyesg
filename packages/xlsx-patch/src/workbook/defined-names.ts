import { type CellRange, parseRange } from './cell-reference.js';
import { attributeOf, unescapeXml } from './xml-text.js';

/**
 * A defined name resolved to the cells it covers. EFRAG names each reportable element's cells after the element's
 * local name — `Assets` is `'General Information'!$E$282` — which is the seam the export writes through (§4.11).
 */
export interface NamedRange {
  readonly sheet: string;
  readonly range: CellRange;
}

const DEFINED_NAME = /<definedName\b([^>]*)>([^<]*)<\/definedName>/g;

/**
 * The workbook-scoped defined names, each to its reference as written — `'General Information'!$E$282`.
 *
 * **Sheet-scoped names are left out.** A name carrying `localSheetId` belongs to one sheet and may share its spelling
 * with a workbook name, so admitting both would make a lookup ambiguous. EFRAG's are filter ranges, which no export
 * writes.
 */
export function readDefinedNames(workbookXml: string): ReadonlyMap<string, string> {
  const names = new Map<string, string>();
  for (const match of workbookXml.matchAll(DEFINED_NAME)) {
    const attributes = match[1];
    const name = attributeOf(attributes, 'name');
    if (name === null || attributeOf(attributes, 'localSheetId') !== null) continue;
    names.set(name, unescapeXml(match[2]));
  }
  return names;
}

/**
 * A reference as one rectangle on one sheet — `'General Information'!$D$406:$D$505` — or `null` for anything else.
 *
 * **`null` covers what a name can hold that is not cells**: a `#REF!` left behind by a deleted range (EFRAG ships
 * several), several areas joined by commas, a whole column, a constant, a formula. A sheet name is quoted when it needs
 * to be, and a quote inside it is doubled — `'Table of Contents & Validation'` is one EFRAG writes.
 */
export function resolveReference(reference: string): NamedRange | null {
  const separator = reference.lastIndexOf('!');
  if (separator <= 0) return null;
  const sheetPart = reference.slice(0, separator);
  const sheet =
    sheetPart.startsWith("'") && sheetPart.endsWith("'") && sheetPart.length >= 2
      ? sheetPart.slice(1, -1).replaceAll("''", "'")
      : /^[A-Za-z_][\w.]*$/.test(sheetPart)
        ? sheetPart
        : null;
  const range = parseRange(reference.slice(separator + 1));
  return sheet === null || range === null ? null : { sheet, range };
}
