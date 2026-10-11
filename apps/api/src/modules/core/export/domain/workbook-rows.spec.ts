import { CELL_TARGET, CELL_VALUE_KIND } from '@easyesg/xlsx-patch';
import { TEMPLATE_GROUP } from '@api/contracts/digital-template-map';
import { tableRows } from './workbook-rows';

const lists = { pollutant: { AmmoniaNH3Member: 'Ammonia (NH3)', AldrinMember: 'Aldrin' }, country: { 'country:MD': 'Moldova, Republic of' } };
const at = (name: string) => ({ kind: CELL_TARGET.NAMED, name }) as const;

/** How a template table takes a report's rows (task 46.1). */
describe('a template table’s rows', () => {
  it('gives an ordinal table’s rows by ordinal, the template’s own IDs standing beside them', () => {
    const rows = tableRows({
      group: { kind: TEMPLATE_GROUP.ORDINAL, axis: 'IdentifierOfSiteTypedAxis', rows: 100 },
      fields: [{ dimensionKey: '', ordinal: 0 }, { dimensionKey: '', ordinal: 4 }],
      lists,
    });
    expect(rows.rowOf({ dimensionKey: '', ordinal: 4 })).toBe(4);
    expect(rows.dimensionOf({ dimensionKey: '', ordinal: 4 })).toBe('5');
    expect(rows.keys).toEqual([]);
  });

  it('fills a keyed table from the top, each row naming the ordinal it describes, counted from 1 — B5’s sites', () => {
    const rows = tableRows({
      group: { kind: TEMPLATE_GROUP.KEYED, axis: 'IdentifierOfSiteTypedAxis', key: at('IdentifierOfSitesInBiodiversitySensitiveAreasTypedAxis'), rows: 100 },
      fields: [{ dimensionKey: '', ordinal: 4 }, { dimensionKey: '', ordinal: 1 }, { dimensionKey: '', ordinal: 4 }],
      lists,
    });
    expect(rows.rowOf({ dimensionKey: '', ordinal: 1 })).toBe(0);
    expect(rows.rowOf({ dimensionKey: '', ordinal: 4 })).toBe(1);
    expect(rows.rowOf({ dimensionKey: '', ordinal: 2 })).toBeNull();
    expect(rows.keys).toEqual([
      { at: { ...at('IdentifierOfSitesInBiodiversitySensitiveAreasTypedAxis'), row: 0 }, value: { kind: CELL_VALUE_KIND.NUMBER, value: '2' } },
      { at: { ...at('IdentifierOfSitesInBiodiversitySensitiveAreasTypedAxis'), row: 1 }, value: { kind: CELL_VALUE_KIND.NUMBER, value: '5' } },
    ]);
  });

  it('fills a classified table in the order the report first gives its members, keyed by EFRAG’s string', () => {
    const rows = tableRows({
      group: { kind: TEMPLATE_GROUP.CLASSIFIED, axis: 'TypeOfPollutantAxis', member: at('TypeOfPollutantAxis'), list: 'pollutant', rows: 100 },
      fields: [{ dimensionKey: 'AmmoniaNH3Member', ordinal: 0 }, { dimensionKey: 'AldrinMember', ordinal: 0 }, { dimensionKey: 'AmmoniaNH3Member', ordinal: 0 }],
      lists,
    });
    expect(rows.rowOf({ dimensionKey: 'AldrinMember', ordinal: 0 })).toBe(1);
    expect(rows.dimensionOf({ dimensionKey: 'AldrinMember', ordinal: 0 })).toBe('AldrinMember');
    expect(rows.keys.map((key) => key.value)).toEqual([
      { kind: CELL_VALUE_KIND.TEXT, value: 'Ammonia (NH3)' },
      { kind: CELL_VALUE_KIND.TEXT, value: 'Aldrin' },
    ]);
  });

  it('qualifies a member stored bare before reading the list — B8’s countries', () => {
    const rows = tableRows({
      group: { kind: TEMPLATE_GROUP.CLASSIFIED, axis: 'CountryOfEmploymentContractAxis', member: at('CountryOfEmploymentContractAxis'), list: 'country', rows: 100, qualify: 'country:' },
      fields: [{ dimensionKey: 'MD', ordinal: 0 }],
      lists,
    });
    expect(rows.keys[0].value).toEqual({ kind: CELL_VALUE_KIND.TEXT, value: 'Moldova, Republic of' });
  });

  it('refuses a report that outgrows the table, rather than leaving a row out', () => {
    const fields = Array.from({ length: 101 }, (_, ordinal) => ({ dimensionKey: '', ordinal }));
    expect(() => tableRows({ group: { kind: TEMPLATE_GROUP.ORDINAL, axis: 'IdentifierOfSiteTypedAxis', rows: 100 }, fields, lists })).toThrow(
      /holds 100 rows, and the report fills 101/u,
    );
  });

  it('refuses a member EFRAG’s list has no string for', () => {
    const run = () =>
      tableRows({
        group: { kind: TEMPLATE_GROUP.CLASSIFIED, axis: 'TypeOfPollutantAxis', member: at('TypeOfPollutantAxis'), list: 'pollutant', rows: 100 },
        fields: [{ dimensionKey: 'UnobtainiumMember', ordinal: 0 }],
        lists,
      }).keys;
    expect(run).toThrow(/holds no string for UnobtainiumMember/u);
  });
});
