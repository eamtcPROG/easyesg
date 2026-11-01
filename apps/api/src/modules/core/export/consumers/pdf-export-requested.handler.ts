import { Injectable } from '@nestjs/common';
import { HandlesJob, type JobContext, type JobHandler } from '@api/infrastructure/queue/job-handler';
import { OnQueue } from '@api/infrastructure/queue/on-queue';
import { EXPORT_QUEUE } from '@api/infrastructure/queue/queue.constants';
import { RetriesWith } from '@api/infrastructure/queue/retries-with';
import { EXPORT_PDF_REQUESTED, EXPORT_RETRY } from '../constants/export.constants';
import { ProducePdfExport } from '../use-cases/produce-pdf-export.use-case';

/**
 * The PDF export's job on the worker (task 44.2; AD-10) — the first long-running job, and since task 44.5 on a queue of
 * its own, so an export burst holds no email behind it (§12.5.6's task-44 row (5)). Its queue and its retry are its own
 * (rows (4) and (5)), declared here beside the job they are for. This is the adapter and nothing more: it reads the
 * payload and hands the attempt to `ProducePdfExport`.
 */
@Injectable()
@HandlesJob(EXPORT_PDF_REQUESTED)
@OnQueue(EXPORT_QUEUE)
@RetriesWith(EXPORT_RETRY)
export class PdfExportRequestedHandler implements JobHandler {
  constructor(private readonly produce: ProducePdfExport) {}

  async handle(payload: Record<string, unknown>, context: JobContext): Promise<void> {
    const { organizationId, exportId } = payload;
    if (typeof organizationId !== 'string' || typeof exportId !== 'string') {
      throw new Error(`${EXPORT_PDF_REQUESTED} payload is missing its organizationId or exportId.`);
    }
    await this.produce.execute({ organizationId, exportId, attempt: context.attempt, attempts: context.attempts });
  }
}
