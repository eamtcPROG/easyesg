import { describe, expect, it } from 'vitest';
import { PATCH_REFUSAL, XlsxPatchRefusedError } from '../patch-refusal.js';
import { locateWorkbookParts, relationshipsPartOf, resolveTarget } from './workbook-parts.js';

const RELS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const parts: Record<string, string> = {
  '_rels/.rels': `<Relationships><Relationship Id="rId1" Type="${RELS}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  'xl/workbook.xml': `<workbook xmlns="main" xmlns:rel="${RELS}"><sheets><sheet name="Table of Contents &amp; Validation" sheetId="16" rel:id="rId3"/><sheet name="Chart" sheetId="2" rel:id="rId9"/></sheets></workbook>`,
  'xl/_rels/workbook.xml.rels': `<Relationships><Relationship Id="rId3" Type="${RELS}/worksheet" Target="worksheets/sheet3.xml"/><Relationship Id="rId9" Type="${RELS}/chartsheet" Target="/xl/chartsheets/sheet1.xml"/></Relationships>`,
};

describe('locating a workbook’s parts', () => {
  it('follows the relationships to the workbook and its worksheets, under the prefix the workbook binds', () => {
    const located = locateWorkbookParts((part) => parts[part] ?? null);
    expect(located.workbook).toBe('xl/workbook.xml');
    expect(located.relationships).toBe('xl/_rels/workbook.xml.rels');
    // A chart sheet holds no cells, so it is not a sheet a value can be written into.
    expect([...located.sheets]).toEqual([['Table of Contents & Validation', 'xl/worksheets/sheet3.xml']]);
  });

  it('refuses a package with no office document', () => {
    try {
      locateWorkbookParts(() => null);
      expect.unreachable();
    } catch (error) {
      expect(error instanceof XlsxPatchRefusedError && error.refusal).toBe(PATCH_REFUSAL.UNSUPPORTED_WORKBOOK);
    }
  });

  it('resolves a target against its source’s directory, or from the root', () => {
    expect(resolveTarget('xl', 'worksheets/sheet1.xml')).toBe('xl/worksheets/sheet1.xml');
    expect(resolveTarget('xl', '../customXml/item1.xml')).toBe('customXml/item1.xml');
    expect(resolveTarget('xl', '/xl/calcChain.xml')).toBe('xl/calcChain.xml');
    expect(relationshipsPartOf('xl/workbook.xml')).toBe('xl/_rels/workbook.xml.rels');
  });
});
