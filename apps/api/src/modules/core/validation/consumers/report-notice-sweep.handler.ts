import { Injectable } from '@nestjs/common';
import { HandlesJob, occurredAtMicrosOf, type JobContext, type JobHandler } from '@api/infrastructure/queue/job-handler';
import { RunsDaily } from '@api/infrastructure/schedule/runs-daily';
import { REPORT_NOTICE_SLOT, REPORT_NOTICE_SWEEP } from '../constants/validation.constants';
import { SweepReportNotices } from '../use-cases/sweep-report-notices.use-case';

/**
 * The day's sweep, on the worker, from the outbox row `ScheduleTicker` writes at its slot (task 51.2; §12.5.6's
 * task-51.2 row (1)). **The adapter and nothing more**: it reads the day and the moment the slot opened, and hands both
 * to `SweepReportNotices`.
 *
 * **The moment is the row's, not the handler's clock**: a sweep retried hours later still counts its days from the
 * morning it was scheduled for.
 */
@Injectable()
@HandlesJob(REPORT_NOTICE_SWEEP)
@RunsDaily(REPORT_NOTICE_SLOT)
export class ReportNoticeSweepHandler implements JobHandler {
  constructor(private readonly sweep: SweepReportNotices) {}

  async handle(payload: Record<string, unknown>, context: JobContext): Promise<void> {
    const { day } = payload;
    if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(day)) {
      throw new Error(`${REPORT_NOTICE_SWEEP} payload carries no day.`);
    }
    const asOf = new Date(Math.floor(occurredAtMicrosOf(payload, context.jobName) / 1000));
    await this.sweep.execute({ asOf, day });
  }
}
