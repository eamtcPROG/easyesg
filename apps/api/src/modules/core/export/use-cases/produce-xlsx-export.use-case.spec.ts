import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CELL_TARGET, CELL_VALUE_KIND } from '@easyesg/xlsx-patch';
import type { DigitalTemplate } from '@api/contracts/digital-template-registry.port';
import type { DigitalTemplateMap } from '@api/contracts/digital-template-map';
import type { ReportWorkbook } from '@api/contracts/report-workbook.port';
import type { TenantWork } from '@api/contracts/tenant-work.port';
import { readDigitalTemplateMap } from '@api/modules/platform/taxonomy/domain/digital-template-map';
import { EXPORT_FORMAT } from '../constants/export.constants';
import type { WorkbookSources } from '../domain/report-workbook';
import type { ExportArtifactStore } from '../interfaces/export-artifact-store.interface';
import type { RequestedExport } from '../models/requested-export.model';
import type { ComposedWorkbook } from './compose-report-workbook.use-case';
import { ProduceXlsxExport } from './produce-xlsx-export.use-case';

const NOW = new Date('2026-10-11T09:30:00Z');
const FILE = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
const REQUESTED: RequestedExport = { id: 'export-7', reportId: 'report-1', format: EXPORT_FORMAT.XLSX, locale: 'ro', requestedBy: 'Ana Rusu' };
const COMMAND = { organizationId: 'org-1', exportId: 'export-7', attempt: 1, attempts: 3 };
const MAP = readDigitalTemplateMap(
  JSON.parse(readFileSync(resolve(process.cwd(), '../../config/seed/vsme-digital-template-map.1.3.0.json'), 'utf8')),
) as DigitalTemplateMap;
const PIN = { templateVersion: '1.3.0', taxonomyVersion: '2026-05-01' };

const sources = (): WorkbookSources => ({
  report: {
    entityName: 'Brutăria',
    lei: null,
    idno: '1002600012345',
    reportingCurrency: 'MDL',
    periodStart: { date: '2026-01-01', timezone: 'Europe/Chisinau' },
    periodEnd: { date: '2026-12-31', timezone: 'Europe/Chisinau' },
  },
  fields: [],
  inputs: [],
  inScope: new Set(),
  run: null,
  findings: null,
  precision: { units: {}, elements: {} },
  labelStanding: null,
  facts: { locale: 'ro', generatedAt: NOW, generatedBy: 'Ana Rusu' },
});

function harness(options: { template?: DigitalTemplate | null } = {}) {
  const tenantWork: TenantWork = { inOrganization: (_scope, work) => work() };
  const store: ExportArtifactStore & { completed: unknown[]; failed: unknown[] } = {
    completed: [],
    failed: [],
    findRequested: () => Promise.resolve(REQUESTED),
    complete: (command) => {
      store.completed.push(command);
      return Promise.resolve();
    },
    fail: (command) => {
      store.failed.push(command);
      return Promise.resolve();
    },
  };
  const composed: unknown[] = [];
  const asked: unknown[] = [];
  const written: ReportWorkbook[] = [];
  const stored: { key: string; contentType: string }[] = [];
  const template: DigitalTemplate | null =
    options.template === undefined ? { version: '1.3.0', taxonomyVersion: '2026-05-01', content: new Uint8Array(), map: MAP } : options.template;
  const produce = new ProduceXlsxExport(
    tenantWork,
    store,
    {
      execute: (query): Promise<ComposedWorkbook> => {
        composed.push(query);
        return Promise.resolve({ sources: sources(), pin: PIN });
      },
    },
    {
      templateFor: (pin) => {
        asked.push(pin);
        return Promise.resolve(template);
      },
    },
    {
      write: (input) => {
        written.push(input.workbook);
        return FILE;
      },
    },
    {
      put: (input) => {
        stored.push({ key: input.key, contentType: input.contentType });
        return Promise.resolve();
      },
    },
    () => NOW,
  );
  return { produce, store, composed, asked, written, stored };
}

/** UC-43's file (task 46.1): the report into the template its pin names, stored as an Excel file, its record settled. */
describe('ProduceXlsxExport', () => {
  it('composes in the export’s language, writes the template the report’s pin names, and stores an Excel file', async () => {
    const { produce, store, composed, asked, written, stored } = harness();
    await produce.execute(COMMAND);

    expect(composed).toEqual([{ reportId: 'report-1', locale: 'ro', facts: { generatedAt: NOW, generatedBy: 'Ana Rusu' } }]);
    expect(asked).toEqual([PIN]);
    // The workbook is the assembly's, over the registered template's own map — its language cell set to English.
    expect(written[0].writes).toContainEqual({
      at: { kind: CELL_TARGET.NAMED, name: 'template_selected_display_language' },
      value: { kind: CELL_VALUE_KIND.TEXT, value: 'English - Official [en]' },
    });
    expect(stored).toEqual([
      { key: 'organizations/org-1/exports/export-7.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    ]);
    expect(store.completed).toEqual([expect.objectContaining({ exportId: 'export-7', byteSize: FILE.byteLength })]);
  });

  it('fails, rather than writing another layout, where no template answers the pin — recorded on the last attempt (FR-51)', async () => {
    const { produce, store, stored } = harness({ template: null });
    await expect(produce.execute({ ...COMMAND, attempt: 3 })).rejects.toThrow('No Digital Template answers the report’s pin 1.3.0 / 2026-05-01.'.replace('’', "'"));
    expect(stored).toEqual([]);
    expect(store.failed).toEqual([{ exportId: 'export-7', failure: "No Digital Template answers the report's pin 1.3.0 / 2026-05-01." }]);
  });
});
