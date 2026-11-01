import { describe, expect, it } from 'vitest';
import { PATCH_REFUSAL } from '../patch-refusal.js';
import { refusalOf } from '../testing/refusal-of.js';
import { CELL_VALUE_KIND } from './cell-value.js';
import { patchSheet } from './patch-sheet.js';

const sheet = [
  '<worksheet><sheetData>',
  '<row r="3" spans="1:6"><c r="C3" s="10"><v>1</v></c><c r="D3" s="646"/><c r="E3" s="647"/></row>',
  '<row r="9"><c r="D9" s="659" t="str"><f>IF(ISBLANK(D6),"-",D6)</f><v>-</v></c></row>',
  '<row r="21"><c r="E21" s="51" t="b" cm="1"><v>0</v></c></row>',
  '<row r="78"><c r="C78" s="5"/><c r="D78" s="5"/></row>',
  '</sheetData><mergeCells count="1"><mergeCell ref="C78:K78"/></mergeCells>',
  '<dataValidations count="1"><dataValidation type="list" sqref="D3"><formula1>enum_ListYesNo</formula1></dataValidation></dataValidations>',
  '</worksheet>',
].join('');

const number = (value: string) => ({ kind: CELL_VALUE_KIND.NUMBER, value }) as const;

describe('patching a worksheet’s XML', () => {
  it('replaces the written cell’s element and nothing else, keeping its place and its style', () => {
    const patched = patchSheet({ sheet: 'General Information', xml: sheet, writes: [{ cell: { column: 4, row: 3 }, value: number('42') }] });
    expect(patched).toBe(sheet.replace('<c r="D3" s="646"/>', '<c r="D3" s="646"><v>42</v></c>'));
  });

  it('replaces a value already there, dropping the attributes that described it', () => {
    const patched = patchSheet({
      sheet: 'General Information',
      xml: sheet,
      writes: [
        { cell: { column: 5, row: 21 }, value: { kind: CELL_VALUE_KIND.BOOLEAN, value: true } },
        { cell: { column: 3, row: 3 }, value: { kind: CELL_VALUE_KIND.TEXT, value: 'Brutăria' } },
      ],
    });
    expect(patched).toBe(
      sheet
        .replace('<c r="E21" s="51" t="b" cm="1"><v>0</v></c>', '<c r="E21" s="51" t="b"><v>1</v></c>')
        .replace('<c r="C3" s="10"><v>1</v></c>', '<c r="C3" s="10" t="inlineStr"><is><t xml:space="preserve">Brutăria</t></is></c>'),
    );
  });

  it('writes the first cell of a merge', () => {
    const patched = patchSheet({ sheet: 'Environmental Disclosures', xml: sheet, writes: [{ cell: { column: 3, row: 78 }, value: number('1') }] });
    expect(patched).toContain('<c r="C78" s="5"><v>1</v></c>');
  });

  it('refuses a cell the template computes (182/32)', () => {
    expect(
      refusalOf(() => patchSheet({ sheet: 'General Information', xml: sheet, writes: [{ cell: { column: 4, row: 9 }, value: number('1') }] })),
    ).toBe(PATCH_REFUSAL.FORMULA_CELL);
  });

  it('refuses a cell inside a merge that is not its first, where nothing written is shown', () => {
    expect(
      refusalOf(() => patchSheet({ sheet: 'Environmental Disclosures', xml: sheet, writes: [{ cell: { column: 4, row: 78 }, value: number('1') }] })),
    ).toBe(PATCH_REFUSAL.MERGED_CELL);
  });

  it('refuses a cell the sheet holds no element for, and a sheet with no cell data', () => {
    expect(
      refusalOf(() => patchSheet({ sheet: 'General Information', xml: sheet, writes: [{ cell: { column: 6, row: 3 }, value: number('1') }] })),
    ).toBe(PATCH_REFUSAL.MISSING_CELL);
    expect(
      refusalOf(() => patchSheet({ sheet: 'Licence', xml: '<worksheet><sheetData/></worksheet>', writes: [{ cell: { column: 1, row: 1 }, value: number('1') }] })),
    ).toBe(PATCH_REFUSAL.MISSING_CELL);
  });

  it('does not mistake a rich-text run’s charset, a column or a conditional format for a cell', () => {
    const rich = '<worksheet><cols><col min="1" max="1"/></cols><sheetData><row r="1"><c r="A1" t="inlineStr"><is><r><rPr><charset val="238"/></rPr><t>x</t></r></is></c><c r="B1"/></row></sheetData><conditionalFormatting><cfRule type="expression"/></conditionalFormatting></worksheet>';
    const patched = patchSheet({ sheet: 'S', xml: rich, writes: [{ cell: { column: 2, row: 1 }, value: number('7') }] });
    expect(patched).toBe(rich.replace('<c r="B1"/>', '<c r="B1"><v>7</v></c>'));
  });
});
