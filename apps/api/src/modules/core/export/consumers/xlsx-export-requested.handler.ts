import { Injectable } from '@nestjs/common';
import { HandlesJob, type JobContext, type JobHandler } from '@api/infrastructure/queue/job-handler';
import { OnQueue } from '@api/infrastructure/queue/on-queue';
import { EXPORT_QUEUE } from '@api/infrastructure/queue/queue.constants';
import { RetriesWith } from '@api/infrastructure/queue/retries-with';
import { EXPORT_RETRY, EXPORT_XLSX_REQUESTED } from '../constants/export.constants';
import { ProduceXlsxExport } from '../use-cases/produce-xlsx-export.use-case';

/**
 * The Excel export's job on the worker (task 46.1; FR-50, AD-10) — beside the PDF's on the export queue of its own, so a
 * burst of exports holds no email behind it, with the export's own retry (§12.5.6's task-44 rows (4), (5)). The adapter
 * and nothing more: it reads the payload and hands the attempt to `ProduceXlsxExport`.
 */
@Injectable()
@HandlesJob(EXPORT_XLSX_REQUESTED)
@OnQueue(EXPORT_QUEUE)
@RetriesWith(EXPORT_RETRY)
export class XlsxExportRequestedHandler implements JobHandler {
  constructor(private readonly produce: ProduceXlsxExport) {}

  async handle(payload: Record<string, unknown>, context: JobContext): Promise<void> {
    const { organizationId, exportId } = payload;
    if (typeof organizationId !== 'string' || typeof exportId !== 'string') {
      throw new Error(`${EXPORT_XLSX_REQUESTED} payload is missing its organizationId or exportId.`);
    }
    await this.produce.execute({ organizationId, exportId, attempt: context.attempt, attempts: context.attempts });
  }
}
