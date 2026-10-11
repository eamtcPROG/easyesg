import { readPart } from '@easyesg/xlsx-patch';

/** What a workbook's machinery comes to: its defined names, and each sheet's data validations and formulas, counted. */
export interface WorkbookStructure {
  readonly definedNames: number;
  readonly sheets: Readonly<Record<string, { readonly validations: number; readonly formulas: number }>>;
}

/**
 * The template's named ranges, dropdowns and formulas, counted per sheet — NFR-20's *intact* (task 46.2). Read from a
 * workbook as LibreOffice saved it: the suite compares an export's round trip with the template's own, so whatever Calc
 * changes in re-saving any workbook cancels out, and a difference is the export's.
 */
export function structureOf(workbook: Uint8Array): WorkbookStructure {
  const text = (part: string) => readPart(workbook, part) ?? '';
  const book = text('xl/workbook.xml');
  const relationships = text('xl/_rels/workbook.xml.rels');
  const targets = new Map(
    [...relationships.matchAll(/<Relationship\b[^>]*\bId="([^"]+)"[^>]*\bTarget="([^"]+)"/g)].map(([, id, target]) => [id, target]),
  );
  const sheets: Record<string, { validations: number; formulas: number }> = {};
  for (const [, name, id] of book.matchAll(/<sheet\b[^>]*\bname="([^"]+)"[^>]*\br:id="([^"]+)"/g)) {
    const target = targets.get(id) ?? '';
    const xml = text(target.startsWith('/') ? target.slice(1) : `xl/${target}`);
    sheets[name] = {
      validations: (xml.match(/<(?:x14:)?dataValidation\b/g) ?? []).length,
      formulas: (xml.match(/<f[\s>/]/g) ?? []).length,
    };
  }
  return { definedNames: (book.match(/<definedName\b/g) ?? []).length, sheets };
}

/**
 * The value a formula cell holds as computed — its cached `<v>` in a workbook LibreOffice computed and saved — or `null`
 * where the cell holds none. Exact, where a sheet's shown value is rounded to its format: what 182/32's proof compares
 * with the platform's stored figure (task 46.4).
 */
export function computedValueOf(workbook: Uint8Array, sheet: string, address: string): string | null {
  const book = readPart(workbook, 'xl/workbook.xml') ?? '';
  const relationships = readPart(workbook, 'xl/_rels/workbook.xml.rels') ?? '';
  const id = [...book.matchAll(/<sheet\b[^>]*\bname="([^"]+)"[^>]*\br:id="([^"]+)"/g)].find(([, name]) => name === sheet.replaceAll('&', '&amp;'))?.[2];
  const target = [...relationships.matchAll(/<Relationship\b[^>]*\bId="([^"]+)"[^>]*\bTarget="([^"]+)"/g)].find(([, rid]) => rid === id)?.[2];
  if (target === undefined) throw new Error(`the workbook has no sheet ${sheet}`);
  const xml = readPart(workbook, target.startsWith('/') ? target.slice(1) : `xl/${target}`) ?? '';
  const cell = new RegExp(`<c r="${address}"[^>]*>([\\s\\S]*?)</c>`).exec(xml)?.[1] ?? '';
  return /<v>([^<]*)<\/v>/.exec(cell)?.[1] ?? null;
}
