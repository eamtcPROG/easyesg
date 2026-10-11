import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import { CELL_TARGET } from './cell-target.js';
import { PATCH_REFUSAL } from './patch-refusal.js';
import { type CellWrite, patchWorkbook } from './patch-workbook.js';
import { COMMITTED_TEMPLATE, committedTemplate } from './testing/committed-templates.js';
import { refusalOf } from './testing/refusal-of.js';
import { resolveCellTarget } from './cell-target.js';
import { formatCell } from './workbook/cell-reference.js';
import { CELL_VALUE_KIND } from './workbook/cell-value.js';
import { resolveReference } from './workbook/defined-names.js';
import { openWorkbook } from './workbook/open-workbook.js';
import { attributeOf, startTags } from './workbook/xml-text.js';
import { entryContent } from './zip/entry-content.js';
import { type ZipEntry, readZip } from './zip/read-zip.js';

/** A central record with its local-offset field blanked, so two archives compare on everything but where it sat. */
const centralWithoutOffset = (entry: ZipEntry): Buffer => {
  const copy = Buffer.from(entry.centralRecord);
  copy.writeUInt32LE(0, 42);
  return copy;
};
const textOf = (entry: ZipEntry | undefined): string => (entry === undefined ? '' : new TextDecoder().decode(entryContent(entry)));
const cellElement = (xml: string, reference: string): string => {
  const match = new RegExp(`<c r="${reference}"(?:[^>]*/>|[^>]*>.*?</c>)`, 's').exec(xml);
  return match === null ? '' : match[0];
};

/** A formula element — a shared one is self-closing, and is matched first so it cannot run on into the next. */
const FORMULA = /<f(?=[\s/>])[^>]*\/>|<f(?=[\s/>])[^>]*>[\s\S]*?<\/f>/g;

const GENERAL = 'xl/worksheets/sheet4.xml';
const SOCIAL = 'xl/worksheets/sheet6.xml';

/** A write of each kind, by name and by address, on two sheets — what an export's first page looks like. */
const writes: readonly CellWrite[] = [
  { at: { kind: CELL_TARGET.NAMED, name: 'template_reporting_entity_name' }, value: { kind: CELL_VALUE_KIND.TEXT, value: 'Brutăria & Fiii "SRL" <test>' } },
  { at: { kind: CELL_TARGET.NAMED, name: 'Assets' }, value: { kind: CELL_VALUE_KIND.NUMBER, value: '1250000.5' } },
  { at: { kind: CELL_TARGET.NAMED, name: 'ReportContainsDisclosuresFromThePreviousReportingPeriodThatRemainUnchanged' }, value: { kind: CELL_VALUE_KIND.BOOLEAN, value: true } },
  { at: { kind: CELL_TARGET.NAMED, name: 'AddressOfSite', row: 2 }, value: { kind: CELL_VALUE_KIND.TEXT, value: '=SUM(A1:A9)' } },
  { at: { kind: CELL_TARGET.ADDRESS, sheet: 'General Information', cell: 'D6' }, value: { kind: CELL_VALUE_KIND.NUMBER, value: '2026' } },
  // B8's departures: an input the template's turnover formula reads and EFRAG names no element for (task 36.10).
  { at: { kind: CELL_TARGET.ADDRESS, sheet: 'Social Disclosures', cell: 'D134' }, value: { kind: CELL_VALUE_KIND.NUMBER, value: '3' } },
];

describe('patching the EFRAG Digital Template', () => {
  describe('a no-op patch (45.1)', () => {
    it.each(Object.values(COMMITTED_TEMPLATE))('returns %s byte for byte', (file) => {
      const template = committedTemplate(file);
      expect(Buffer.from(patchWorkbook({ template, writes: [] })).equals(Buffer.from(template))).toBe(true);
    });
  });

  describe('a patch with values (45.2)', () => {
    const template = committedTemplate(COMMITTED_TEMPLATE.V1_3_0);
    const before = readZip(template);
    const after = readZip(patchWorkbook({ template, writes }));
    const entryOf = (archive: typeof before, name: string) => archive.entries.find((entry) => entry.name === name);

    it('changes the written sheets, the workbook, its relationships and the content types, and drops the calc chain — and no other part', () => {
      const changed = before.entries
        .filter((entry) => {
          const other = entryOf(after, entry.name);
          return other === undefined || !Buffer.from(other.localRecord).equals(Buffer.from(entry.localRecord)) || !centralWithoutOffset(other).equals(centralWithoutOffset(entry));
        })
        .map((entry) => (entryOf(after, entry.name) === undefined ? `${entry.name} (dropped)` : entry.name))
        .sort();

      expect(changed).toEqual(['[Content_Types].xml', GENERAL, SOCIAL, 'xl/_rels/workbook.xml.rels', 'xl/calcChain.xml (dropped)', 'xl/workbook.xml'].sort());
      expect(after.entries.map((entry) => entry.name)).toEqual(before.entries.map((entry) => entry.name).filter((name) => name !== 'xl/calcChain.xml'));
    });

    it('changes each written sheet in its written cells’ elements alone', () => {
      for (const [part, references] of [
        [GENERAL, ['D3', 'E282', 'E21', 'D408', 'D6']],
        [SOCIAL, ['D134']],
      ] as const) {
        const original = textOf(entryOf(before, part));
        const patched = textOf(entryOf(after, part));
        const rebuilt = references.reduce((xml, reference) => xml.replace(cellElement(original, reference), cellElement(patched, reference)), original);
        expect(rebuilt).toBe(patched);
        // Every written cell kept its style.
        for (const reference of references) {
          expect(attributeOf(cellElement(patched, reference), 's')).toBe(attributeOf(cellElement(original, reference), 's'));
        }
      }
    });

    it('writes each value as its kind, text as text whatever it begins with', () => {
      const general = textOf(entryOf(after, GENERAL));
      expect(cellElement(general, 'D3')).toBe('<c r="D3" s="646" t="inlineStr"><is><t xml:space="preserve">Brutăria &amp; Fiii &quot;SRL&quot; &lt;test&gt;</t></is></c>');
      expect(cellElement(general, 'E282')).toBe('<c r="E282" s="57"><v>1250000.5</v></c>');
      expect(cellElement(general, 'E21')).toBe('<c r="E21" s="51" t="b"><v>1</v></c>');
      expect(cellElement(general, 'D408')).toBe('<c r="D408" s="72" t="inlineStr"><is><t xml:space="preserve">=SUM(A1:A9)</t></is></c>');
    });

    it('leaves every formula, every data validation and every merge of a written sheet as it was', () => {
      for (const part of [GENERAL, SOCIAL]) {
        const original = textOf(entryOf(before, part));
        const patched = textOf(entryOf(after, part));
        expect(patched.match(FORMULA)).toEqual(original.match(FORMULA));
        expect(/<dataValidations[\s\S]*?<\/dataValidations>/.exec(patched)?.[0]).toBe(/<dataValidations[\s\S]*?<\/dataValidations>/.exec(original)?.[0]);
        expect(/<mergeCells[\s\S]*?<\/mergeCells>/.exec(patched)?.[0]).toBe(/<mergeCells[\s\S]*?<\/mergeCells>/.exec(original)?.[0]);
      }
    });

    it('asks the consumer to recalculate on open, and forgets the calc chain in every place that named it', () => {
      const workbook = textOf(entryOf(after, 'xl/workbook.xml'));
      expect(workbook).toBe(textOf(entryOf(before, 'xl/workbook.xml')).replace('<calcPr calcId="191028"/>', '<calcPr calcId="191028" fullCalcOnLoad="1"/>'));
      expect(textOf(entryOf(after, 'xl/_rels/workbook.xml.rels'))).not.toContain('calcChain');
      expect(textOf(entryOf(after, '[Content_Types].xml'))).not.toContain('calcChain');
    });

    /**
     * **The shape the worker hands over, and the one every other case here does not.** `committedTemplate` copies into
     * a plain `Uint8Array`; `fs.readFile` answers a Node `Buffer`, whose `slice` is a view. Patched as a `Buffer`, the
     * first build wrote the replaced entries' header fields into the caller's template and left their central records
     * stating the old sizes — a file Python's `zipfile` refuses as overlapping entries, and LibreOffice was never asked.
     */
    it('patches a template handed over as a Node Buffer, and leaves that Buffer as it was', () => {
      const buffer = Buffer.from(template);
      const untouched = Buffer.from(template);
      const patched = patchWorkbook({ template: buffer, writes });

      expect(buffer.equals(untouched)).toBe(true);
      expect(Buffer.from(patched).equals(Buffer.from(patchWorkbook({ template, writes })))).toBe(true);
      for (const entry of readZip(patched).entries) expect(entryContent(entry).byteLength).toBe(entry.uncompressedSize);
    });

    it('patches the February template too', () => {
      const february = committedTemplate(COMMITTED_TEMPLATE.V1_2_0);
      const patched = patchWorkbook({ template: february, writes: [{ at: { kind: CELL_TARGET.NAMED, name: 'Assets' }, value: { kind: CELL_VALUE_KIND.NUMBER, value: '7' } }] });
      const reread = openWorkbook(patched);
      const assets = resolveCellTarget(reread, { kind: CELL_TARGET.NAMED, name: 'Assets' });
      expect(cellElement(reread.text(assets.part) ?? '', formatCell(assets.cell))).toMatch(/<v>7<\/v><\/c>$/);
    });
  });

  /** The parts a patch changed, added or dropped — what AD-10's *every other part byte for byte* is checked against. */
  const touched = (before: ReturnType<typeof readZip>, after: ReturnType<typeof readZip>): string[] => {
    const of = (archive: typeof before, name: string) => archive.entries.find((entry) => entry.name === name);
    const changed = before.entries
      .filter((entry) => {
        const other = of(after, entry.name);
        return other === undefined || !Buffer.from(other.localRecord).equals(Buffer.from(entry.localRecord)) || !centralWithoutOffset(other).equals(centralWithoutOffset(entry));
      })
      .map((entry) => (of(after, entry.name) === undefined ? `${entry.name} (dropped)` : entry.name));
    const added = after.entries.filter((entry) => of(before, entry.name) === undefined).map((entry) => `${entry.name} (added)`);
    return [...changed, ...added].sort();
  };

  describe('the file’s own properties (task 46; task-46 rows (4), (7))', () => {
    const template = committedTemplate(COMMITTED_TEMPLATE.V1_3_0);
    const properties = { application: 'EasyESG', language: 'ru', modified: new Date(Date.UTC(2026, 9, 11, 9, 0, 0)), lastModifiedBy: 'Ana Popescu' };

    it('changes the two property parts and nothing else, given no values', () => {
      expect(touched(readZip(template), readZip(patchWorkbook({ template, writes: [], properties })))).toEqual(['docProps/app.xml', 'docProps/core.xml']);
    });

    it('names the platform as the application — what makes LibreOffice compute the template’s formulas on open', () => {
      const app = textOf(readZip(patchWorkbook({ template, writes, properties })).entries.find((entry) => entry.name === 'docProps/app.xml'));
      expect(app).toContain('<Application>EasyESG</Application>');
      expect(app).not.toContain('Microsoft Excel');
    });
  });

  describe('notes, for a template with no Footnotes sheet (task 46; task-46 row (9))', () => {
    const template = committedTemplate(COMMITTED_TEMPLATE.V1_2_0);
    const notes = [
      { at: { kind: CELL_TARGET.NAMED, name: 'Assets' } as const, text: 'Company estimate' },
      // `Assets` is `E280` in 1.2.0 — the map names cells by EFRAG's names for exactly this reason.
      { at: { kind: CELL_TARGET.ADDRESS, sheet: 'General Information', cell: 'E280' } as const, text: 'Reason given: a second note on the same cell' },
      // A cell the template computes takes a note as readily as one it asks for (task-46 row (3)).
      { at: { kind: CELL_TARGET.NAMED, name: 'EmployeeTurnoverRate' } as const, text: 'The undertaking reports 8%' },
    ];
    const patched = patchWorkbook({ template, writes: [], notes, noteAuthor: 'EasyESG' });

    it('changes each noted sheet, its relationships and the content types, adds a comments part and a drawing per sheet — nothing else', () => {
      expect(touched(readZip(template), readZip(patched))).toEqual(
        [
          '[Content_Types].xml',
          'xl/worksheets/sheet3.xml',
          'xl/worksheets/sheet5.xml',
          'xl/worksheets/_rels/sheet3.xml.rels',
          'xl/worksheets/_rels/sheet5.xml.rels',
          'xl/comments1.xml (added)',
          'xl/comments2.xml (added)',
          'xl/drawings/vmlDrawing1.vml (added)',
          'xl/drawings/vmlDrawing2.vml (added)',
        ].sort(),
      );
    });

    it('joins two notes on one cell into one, in the order given, and writes every part a reader can check', () => {
      const archive = readZip(patched);
      for (const entry of archive.entries) expect(entryContent(entry).byteLength).toBe(entry.uncompressedSize);
      const comments = textOf(archive.entries.find((entry) => entry.name === 'xl/comments1.xml'));
      expect(comments.match(/<comment /g)).toHaveLength(1);
      expect(comments).toContain('Company estimate\n\nReason given: a second note on the same cell');
    });

    it('is the same bytes twice — the new parts take the workbook part’s timestamp, not the clock’s', () => {
      expect(Buffer.from(patchWorkbook({ template, writes: [], notes, noteAuthor: 'EasyESG' })).equals(Buffer.from(patched))).toBe(true);
    });

    it('refuses notes with no author to attribute them to', () => {
      expect(refusalOf(() => patchWorkbook({ template, writes: [], notes }))).toBe(PATCH_REFUSAL.MALFORMED_TEXT);
    });
  });

  describe('refusals over the real template', () => {
    const template = committedTemplate(COMMITTED_TEMPLATE.V1_3_0);
    const one = (write: CellWrite) => () => patchWorkbook({ template, writes: [write] });
    const seven = { kind: CELL_VALUE_KIND.NUMBER, value: '7' } as const;

    it('a figure the template computes — B8’s turnover rate', () => {
      expect(refusalOf(one({ at: { kind: CELL_TARGET.NAMED, name: 'EmployeeTurnoverRate' }, value: seven }))).toBe(PATCH_REFUSAL.FORMULA_CELL);
    });

    it('a cell under B4’s merged unit field that is not its first', () => {
      expect(refusalOf(one({ at: { kind: CELL_TARGET.ADDRESS, sheet: 'Environmental Disclosures', cell: 'D78' }, value: seven }))).toBe(PATCH_REFUSAL.MERGED_CELL);
    });

    it('a name EFRAG ships broken, a name that does not exist, a sheet that does not exist, an offset outside its range', () => {
      expect(refusalOf(one({ at: { kind: CELL_TARGET.NAMED, name: 'enum_ListNACECode' }, value: seven }))).toBe(PATCH_REFUSAL.UNRESOLVABLE_NAME);
      expect(refusalOf(one({ at: { kind: CELL_TARGET.NAMED, name: 'NoSuchElement' }, value: seven }))).toBe(PATCH_REFUSAL.UNKNOWN_NAME);
      expect(refusalOf(one({ at: { kind: CELL_TARGET.ADDRESS, sheet: 'No Such Sheet', cell: 'A1' }, value: seven }))).toBe(PATCH_REFUSAL.UNKNOWN_SHEET);
      expect(refusalOf(one({ at: { kind: CELL_TARGET.NAMED, name: 'AddressOfSite', row: 100 }, value: seven }))).toBe(PATCH_REFUSAL.OUTSIDE_RANGE);
      expect(refusalOf(one({ at: { kind: CELL_TARGET.NAMED, name: 'AddressOfSite', column: 1 }, value: seven }))).toBe(PATCH_REFUSAL.OUTSIDE_RANGE);
      expect(refusalOf(one({ at: { kind: CELL_TARGET.NAMED, name: 'AddressOfSite', row: -1 }, value: seven }))).toBe(PATCH_REFUSAL.OUTSIDE_RANGE);
      expect(refusalOf(one({ at: { kind: CELL_TARGET.ADDRESS, sheet: 'General Information', cell: 'E 282' }, value: seven }))).toBe(PATCH_REFUSAL.OUTSIDE_RANGE);
    });

    it('one cell written twice, however it was named', () => {
      expect(
        refusalOf(() =>
          patchWorkbook({
            template,
            writes: [
              { at: { kind: CELL_TARGET.NAMED, name: 'Assets' }, value: seven },
              { at: { kind: CELL_TARGET.ADDRESS, sheet: 'General Information', cell: 'E282' }, value: seven },
            ],
          }),
        ),
      ).toBe(PATCH_REFUSAL.DUPLICATE_WRITE);
    });
  });

  /**
   * **The census `patchSheet`'s missing-cell refusal rests on**: in every registered template, every cell a resolvable
   * defined name covers already exists as an element, so that refusal never fires on a name the template carries —
   * and every name that does not resolve is one EFRAG shipped as `#REF!`, which is refused by name instead.
   */
  describe.each([COMMITTED_TEMPLATE.V1_2_0, COMMITTED_TEMPLATE.V1_3_0])('the defined names of %s', (file) => {
    it('each resolves to cells that all exist, or is a #REF! the package refuses', () => {
      const workbook = openWorkbook(committedTemplate(file));
      const present = new Map<string, Set<string>>();
      const missing: string[] = [];
      const unresolved: string[] = [];
      for (const [name, reference] of workbook.names) {
        const named = resolveReference(reference);
        if (named === null) {
          unresolved.push(reference);
          continue;
        }
        const part = workbook.parts.sheets.get(named.sheet) ?? '';
        const cells = present.get(part) ?? new Set(startTags(workbook.text(part) ?? '', 'c').map(({ tag }) => attributeOf(tag, 'r') ?? ''));
        present.set(part, cells);
        for (let row = named.range.start.row; row <= named.range.end.row; row += 1) {
          for (let column = named.range.start.column; column <= named.range.end.column; column += 1) {
            if (!cells.has(formatCell({ column, row }))) missing.push(`${name}!${formatCell({ column, row })}`);
          }
        }
      }
      expect(missing).toEqual([]);
      expect(unresolved.length).toBeGreaterThan(0);
      expect(unresolved.every((reference) => reference.endsWith('#REF!'))).toBe(true);
    });
  });
});
