import { createHash } from 'node:crypto';
import type { ObjectStorage } from '@api/contracts/object-storage.port';
import type { PdfRenderer } from '@api/contracts/pdf-renderer.port';
import type { ReportDocumentRenderer } from '@api/contracts/report-document.port';
import type { TenantWork } from '@api/contracts/tenant-work.port';
import { EXPORT_FORMAT } from '../constants/export.constants';
import { exportObjectKey } from '../domain/export-object-key';
import type { ExportArtifactStore } from '../interfaces/export-artifact-store.interface';
import type { ComposeReportDocument } from './compose-report-document.use-case';

export interface ProducePdfExportCommand {
  readonly organizationId: string;
  readonly exportId: string;
  /** Which attempt this is, and how many the job is given — the last records the failure (§12.5.6's task-44 row (4)). */
  readonly attempt: number;
  readonly attempts: number;
}

/**
 * UC-42's file (task 44.2; FR-49, FR-53, AD-10): the export's document, composed from stored data in the export's own
 * language, printed by the renderer, stored, and its record settled.
 *
 * **Three steps, two units of work, and nothing held open across a render.** The record is read and the document
 * composed inside the organization's unit of work (`TENANT_WORK`), which ends before the renderer is called — a render
 * may run a minute (§12.5.6's task-44 row (4)) and a transaction held across it would hold a connection with it. The
 * file is stored under a key of its own export, so an attempt abandoned after storing is overwritten by the next, and
 * the record is settled in a second unit of work.
 *
 * **Effectively once** (AD-6): an export already settled reads as none, so a re-emitted job, or one that follows an
 * attempt which settled it, does nothing. **A failure is recorded on the last attempt only**, and every failure is
 * thrown so the queue retries it on a fresh browser (T-13); the earlier attempts' failures are the queue's to keep.
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
    private readonly now: () => Date,
  ) {}

  async execute(command: ProducePdfExportCommand): Promise<void> {
    const { organizationId, exportId } = command;
    const generatedAt = this.now();
    try {
      const markup = await this.tenantWork.inOrganization({ organizationId }, async () => {
        const requested = await this.store.findRequested({ exportId });
        if (requested === null) return null;
        const document = await this.compose.execute({
          reportId: requested.reportId,
          locale: requested.locale,
          production: { generatedAt, generatedBy: requested.requestedBy },
        });
        return this.documents.render(document);
      });
      if (markup === null) return;

      const pdf = await this.printer.print({ markup, generatedAt });
      const objectKey = exportObjectKey({ organizationId, exportId, format: EXPORT_FORMAT.PDF });
      await this.storage.put({ key: objectKey, body: pdf, contentType: 'application/pdf' });
      await this.tenantWork.inOrganization({ organizationId }, () =>
        this.store.complete({
          exportId,
          generatedAt,
          objectKey,
          byteSize: pdf.length,
          sha256: createHash('sha256').update(pdf).digest('hex'),
        }),
      );
    } catch (error) {
      if (command.attempt >= command.attempts) {
        await this.tenantWork.inOrganization({ organizationId }, () =>
          this.store.fail({ exportId, failure: error instanceof Error ? error.message : String(error) }),
        );
      }
      throw error;
    }
  }
}
