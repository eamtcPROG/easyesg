import { describe, expect, it } from 'vitest';
import { PATCH_REFUSAL, XlsxPatchRefusedError } from '../patch-refusal.js';
import { CALC_CHAIN_RELATIONSHIP, withFullCalcOnLoad, withoutOverride, withoutRelationships } from './recalculate-on-open.js';

describe('making a consumer recalculate on open', () => {
  it('adds fullCalcOnLoad to calcPr, or sets the one there, and touches nothing else', () => {
    expect(withFullCalcOnLoad('<definedNames/><calcPr calcId="191028"/><extLst/>')).toBe(
      '<definedNames/><calcPr calcId="191028" fullCalcOnLoad="1"/><extLst/>',
    );
    expect(withFullCalcOnLoad(`<calcPr fullCalcOnLoad='0' calcId="1"></calcPr>`)).toBe('<calcPr fullCalcOnLoad="1" calcId="1"></calcPr>');
  });

  it('refuses a workbook with no calculation properties rather than guessing where they go', () => {
    let refused: unknown = null;
    try {
      withFullCalcOnLoad('<workbook><sheets/></workbook>');
    } catch (error) {
      refused = error;
    }
    expect(refused instanceof XlsxPatchRefusedError && refused.refusal).toBe(PATCH_REFUSAL.UNSUPPORTED_WORKBOOK);
  });

  it('removes the calc chain’s relationship and names its target', () => {
    const rels = `<Relationships><Relationship Id="rId4" Type="x/worksheet" Target="worksheets/sheet4.xml"/><Relationship Id="rId22" Type="${CALC_CHAIN_RELATIONSHIP}" Target="calcChain.xml"/></Relationships>`;
    expect(withoutRelationships(rels, CALC_CHAIN_RELATIONSHIP)).toEqual({
      xml: '<Relationships><Relationship Id="rId4" Type="x/worksheet" Target="worksheets/sheet4.xml"/></Relationships>',
      targets: ['calcChain.xml'],
    });
    expect(withoutRelationships('<Relationships/>', CALC_CHAIN_RELATIONSHIP)).toEqual({ xml: '<Relationships/>', targets: [] });
  });

  it('removes the override for one part, by its part name', () => {
    const types = '<Types><Override PartName="/xl/workbook.xml" ContentType="a"/><Override PartName="/xl/calcChain.xml" ContentType="b"/></Types>';
    expect(withoutOverride(types, 'xl/calcChain.xml')).toBe('<Types><Override PartName="/xl/workbook.xml" ContentType="a"/></Types>');
    expect(withoutOverride(types, 'xl/other.xml')).toBe(types);
  });
});
