import { describe, expect, it } from 'vitest';
import { readDefinedNames, resolveReference } from './defined-names.js';

describe('defined names', () => {
  const workbook = [
    '<definedNames>',
    `<definedName name="_xlnm._FilterDatabase" localSheetId="12" hidden="1">Translations!$A$1:$N$477</definedName>`,
    `<definedName name="Assets">'General Information'!$E$282</definedName>`,
    `<definedName name="enum_ListNACECode">'Enumeration Lists'!#REF!</definedName>`,
    `<definedName name="Quoted">'It''s &amp; more'!$A$1:$B$2</definedName>`,
    '</definedNames>',
  ].join('');

  it('reads the workbook-scoped names and leaves a sheet’s own out', () => {
    expect([...readDefinedNames(workbook)]).toEqual([
      ['Assets', `'General Information'!$E$282`],
      ['enum_ListNACECode', `'Enumeration Lists'!#REF!`],
      ['Quoted', `'It''s & more'!$A$1:$B$2`],
    ]);
  });

  it('resolves a reference to one rectangle on one sheet, quoted or bare', () => {
    expect(resolveReference(`'General Information'!$E$282`)).toEqual({
      sheet: 'General Information',
      range: { start: { column: 5, row: 282 }, end: { column: 5, row: 282 } },
    });
    expect(resolveReference(`'It''s & more'!$A$1:$B$2`)?.sheet).toBe(`It's & more`);
    expect(resolveReference('Footnotes!$B$4:$D$1523')?.range.end).toEqual({ column: 4, row: 1523 });
  });

  it('resolves nothing that is not cells — a #REF!, two areas, a column, a constant, a formula', () => {
    for (const reference of [
      `'Enumeration Lists'!#REF!`,
      `Sheet1!$A$1,Sheet1!$B$2`,
      'Sheet1!$A:$A',
      '"constant"',
      'OFFSET(Sheet1!$A$1,0,0)',
      `'unterminated!$A$1`,
    ]) {
      expect(resolveReference(reference)).toBeNull();
    }
  });
});
