import type { DigitalTemplateRegistry } from '@api/contracts/digital-template-registry.port';
import type { ObjectStorage } from '@api/contracts/object-storage.port';
import type { ReportWorkbookWriter } from '@api/contracts/report-workbook.port';
import type { TenantWork } from '@api/contracts/tenant-work.port';
import { EXPORT_FORMAT } from '../constants/export.constants';
import { assembleReportWorkbook } from '../domain/report-workbook';
import type { ExportArtifactStore } from '../interfaces/export-artifact-store.interface';
import type { ComposeReportWorkbook } from './compose-report-workbook.use-case';
import { type ExportAttemptCommand, runExportAttempt } from './run-export-attempt';

/**
 * UC-43's file (task 46.1; FR-50, FR-53, AD-10): the report written into the EFRAG Digital Template its pin names — the
 * values in the template's own cells, its formulas left to compute, every gap and estimate marked — stored, and its
 * record settled by `runExportAttempt`'s rule, the one the PDF's job settles by.
 *
 * **The template is the pin's, never a nearby one** (FR-51): the registry answers the binary and its map for the
 * report's own template and taxonomy versions, or nothing — and nothing is a failure an operator reads on the record,
 * not a file written against another layout.
 *
 * **Who produced it and when are the file's facts** (NFR-22; task-46 row (7)), carried as its document properties.
 */
export class ProduceXlsxExport {
  constructor(
    private readonly tenantWork: TenantWork,
    private readonly store: ExportArtifactStore,
    private readonly compose: Pick<ComposeReportWorkbook, 'execute'>,
    private readonly templates: DigitalTemplateRegistry,
    private readonly writer: ReportWorkbookWriter,
    private readonly storage: ObjectStorage,
    private readonly now: () => Date,
  ) {}

  execute(command: ExportAttemptCommand): Promise<void> {
    return runExportAttempt({
      command,
      format: EXPORT_FORMAT.XLSX,
      tenantWork: this.tenantWork,
      store: this.store,
      storage: this.storage,
      now: this.now,
      compose: (requested, generatedAt) =>
        this.compose.execute({
          reportId: requested.reportId,
          locale: requested.locale,
          facts: { generatedAt, generatedBy: requested.requestedBy },
        }),
      produce: async ({ sources, pin }) => {
        const template = await this.templates.templateFor(pin);
        if (template === null) {
          throw new Error(`No Digital Template answers the report's pin ${pin.templateVersion} / ${pin.taxonomyVersion}.`);
        }
        return this.writer.write({ template, workbook: assembleReportWorkbook(sources, template.map) });
      },
    });
  }
}
