import type { NotificationPort } from '@api/contracts/notification.port';
import type { ObjectStorage } from '@api/contracts/object-storage.port';
import type { PdfRenderer } from '@api/contracts/pdf-renderer.port';
import type { ReportDocumentRenderer } from '@api/contracts/report-document.port';
import type { TenantWork } from '@api/contracts/tenant-work.port';
import { EXPORT_FORMAT } from '../constants/export.constants';
import type { ExportArtifactStore } from '../interfaces/export-artifact-store.interface';
import type { ComposeReportDocument } from './compose-report-document.use-case';
import { type ExportAttemptCommand, runExportAttempt } from './run-export-attempt';

export type ProducePdfExportCommand = ExportAttemptCommand;

/**
 * UC-42's file (task 44.2; FR-49, FR-53, AD-10): the export's document, composed from stored data in the export's own
 * language, printed by the renderer, stored, and its record settled — by `runExportAttempt`'s rule, which the Excel
 * export shares since task 46: the record read and the document composed in the organization's unit of work, the
 * render outside any, settled once, a failure recorded on the last attempt.
 *
 * **Who produced it and when are the file's facts**, written into it (NFR-22; FR-49 behaviour 5): the moment this
 * attempt began, and the person who asked.
 */
export class ProducePdfExport {
  constructor(
    private readonly tenantWork: TenantWork,
    private readonly store: ExportArtifactStore,
    private readonly compose: Pick<ComposeReportDocument, 'execute'>,
    private readonly documents: ReportDocumentRenderer,
    private readonly printer: PdfRenderer,
    private readonly storage: ObjectStorage,
    private readonly notifications: NotificationPort,
    private readonly now: () => Date,
  ) {}

  execute(command: ProducePdfExportCommand): Promise<void> {
    return runExportAttempt({
      command,
      format: EXPORT_FORMAT.PDF,
      tenantWork: this.tenantWork,
      store: this.store,
      storage: this.storage,
      notifications: this.notifications,
      now: this.now,
      compose: async (requested, generatedAt) =>
        this.documents.render(
          await this.compose.execute({
            reportId: requested.reportId,
            locale: requested.locale,
            production: { generatedAt, generatedBy: requested.requestedBy },
          }),
        ),
      produce: (markup, generatedAt) => this.printer.print({ markup, generatedAt }),
    });
  }
}
