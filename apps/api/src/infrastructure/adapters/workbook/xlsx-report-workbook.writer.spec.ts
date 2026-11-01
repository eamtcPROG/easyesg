import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CELL_TARGET, CELL_VALUE_KIND, readPart } from '@easyesg/xlsx-patch';
import { initialiseCatalogue } from '@api/app/messages/catalogue';
import type { DigitalTemplate } from '@api/contracts/digital-template-registry.port';
import { WORKBOOK_NOTE, type ReportWorkbook } from '@api/contracts/report-workbook.port';
import { readDigitalTemplateMap } from '@api/modules/platform/taxonomy/domain/digital-template-map';
import { XlsxReportWorkbookWriter } from './xlsx-report-workbook.writer';

const ROOT = resolve(process.cwd(), '../..');
const templateOf = (version: string, file: string): DigitalTemplate => {
  const map = readDigitalTemplateMap(JSON.parse(readFileSync(resolve(ROOT, `config/seed/vsme-digital-template-map.${version}.json`), 'utf8')));
  if (map === null) throw new Error(`the shipped ${version} map does not read`);
  return { version, taxonomyVersion: map.taxonomyVersion, content: new Uint8Array(readFileSync(resolve(ROOT, 'config/efrag', version, file))), map };
};
const may = templateOf('1.3.0', 'VSME-Digital-Template-1.3.0.xlsx');
const february = templateOf('1.2.0', 'VSME-Digital-Template-1.2.0.xlsx');

const assets = { kind: CELL_TARGET.NAMED, name: 'Assets' } as const;
const workbook = (locale: 'en' | 'ro'): ReportWorkbook => ({
  writes: [{ at: assets, value: { kind: CELL_VALUE_KIND.NUMBER, value: '1250000' } }],
  notes: [
    { element: 'Assets', dimension: '', at: assets, says: { kind: WORKBOOK_NOTE.NOT_AVAILABLE, reason: 'Audit pending' } },
    { element: 'Assets', dimension: '', at: assets, says: { kind: WORKBOOK_NOTE.FACTOR_SET, label: 'Emission factor set 2026.1' } },
    {
      element: 'EnergyConsumptionFromFuels',
      dimension: 'RenewableEnergyMember',
      at: { kind: CELL_TARGET.NAMED, name: 'EnergyConsumptionFromFuels_RenewableEnergyMember' },
      says: { kind: WORKBOOK_NOTE.OWN_FIGURE, figure: { value: '12.5', places: 2, unit: 'MWh' } },
    },
  ],
  facts: { locale, generatedAt: new Date('2026-10-11T09:00:05Z'), generatedBy: 'Ana Popescu' },
});

/** Every inline string a sheet part carries, by its cell — what a reader of the file sees there. */
const inlineStrings = (xml: string): Map<string, string> =>
  new Map([...xml.matchAll(/<c r="([A-Z]+\d+)"[^>]*t="inlineStr"[^>]*><is><t[^>]*>([^<]*)<\/t><\/is><\/c>/g)].map(([, cell, text]) => [cell, text]));

/** The Excel export's adapter (task 46): the notes worded and laid out as each template permits, the file's own facts. */
describe('XlsxReportWorkbookWriter', () => {
  beforeAll(async () => {
    await initialiseCatalogue();
  });

  const writer = new XlsxReportWorkbookWriter();

  it('lays each figure’s notes out as one footnote on 1.3.0’s Footnotes sheet, naming its cell from EFRAG’s list (task-46 row (2))', () => {
    const file = writer.write({ template: may, workbook: workbook('en') });
    const footnotes = inlineStrings(readPart(file, 'xl/worksheets/sheet8.xml') ?? '');
    expect(footnotes.get('B4')).toBe(
      'Not available: the undertaking could not obtain this information for the reporting period. Reason given: Audit pending ' +
        'Calculated by the platform with the emission factor set Emission factor set 2026.1.',
    );
    expect(footnotes.get('D4')).toBe('Assets');
    expect(footnotes.has('C4')).toBe(false);
    expect(footnotes.get('B14')).toBe(
      'The undertaking reports 12.50 MWh for this figure. The template computes its own from the cells it reads, and the two may differ.',
    );
    expect(footnotes.get('C14')).toBe('RenewableEnergyMember');
    expect(footnotes.get('D14')).toBe('Energy consumption from fuels');
  });

  it('writes one footnote for one text, naming every figure it explains on its own row of the block', () => {
    const factorSet = { kind: WORKBOOK_NOTE.FACTOR_SET, label: 'Emission factor set 2026.1' } as const;
    const scopes: ReportWorkbook = {
      ...workbook('en'),
      notes: ['GrossScope1GreenhouseGasEmissions', 'GrossLocationBasedScope2GreenhouseGasEmissions'].map((element) => ({
        element,
        dimension: '',
        at: { kind: CELL_TARGET.NAMED, name: element },
        says: factorSet,
      })),
    };
    const footnotes = inlineStrings(readPart(writer.write({ template: may, workbook: scopes }), 'xl/worksheets/sheet8.xml') ?? '');
    expect(footnotes.get('B4')).toBe('Calculated by the platform with the emission factor set Emission factor set 2026.1.');
    expect([footnotes.get('D4'), footnotes.get('D5'), footnotes.has('B14')]).toEqual(['Gross Scope 1 greenhouse gas emissions', 'Gross location-based Scope 2 greenhouse gas emissions', false]);
  });

  it('words the notes in the export’s language', () => {
    const footnotes = inlineStrings(readPart(writer.write({ template: may, workbook: workbook('ro') }), 'xl/worksheets/sheet8.xml') ?? '');
    expect(footnotes.get('B4')).toMatch(/^Indisponibil: întreprinderea nu a putut obține/u);
  });

  it('puts each note on its figure’s cell where the template has no Footnotes sheet — 1.2.0 (task-46 row (9))', () => {
    const file = writer.write({ template: february, workbook: workbook('en') });
    const comments = readPart(file, 'xl/comments1.xml') ?? '';
    expect(comments).toContain('ref="E280"');
    expect(comments).toContain('Reason given: Audit pending');
    expect(readPart(file, 'xl/comments2.xml')).toContain('ref="G14"');
  });

  it('names the platform as the file’s application, and carries its language, moment and person (task-46 rows (4), (7))', () => {
    const file = writer.write({ template: may, workbook: workbook('ro') });
    expect(readPart(file, 'docProps/app.xml')).toContain('<Application>EasyESG</Application>');
    const core = readPart(file, 'docProps/core.xml') ?? '';
    expect(core).toContain('<dc:language>ro</dc:language>');
    expect(core).toContain('<dcterms:modified xsi:type="dcterms:W3CDTF">2026-10-11T09:00:05Z</dcterms:modified>');
    expect(core).toContain('<cp:lastModifiedBy>Ana Popescu</cp:lastModifiedBy>');
  });
});
