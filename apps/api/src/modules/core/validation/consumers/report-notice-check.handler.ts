import { Injectable } from '@nestjs/common';
import { HandlesJob, type JobHandler } from '@api/infrastructure/queue/job-handler';
import { REPORT_NOTICE_CHECK } from '../constants/validation.constants';
import { CheckReportNotices } from '../use-cases/check-report-notices.use-case';

/**
 * One period's check, on the worker, from the row the day's sweep scheduled (task 51.2). The adapter: it validates the
 * payload — the organization the dispatcher puts beside every job, the period, and the sweep's moment — and hands it to
 * `CheckReportNotices`.
 */
@Injectable()
@HandlesJob(REPORT_NOTICE_CHECK)
export class ReportNoticeCheckHandler implements JobHandler {
  constructor(private readonly check: CheckReportNotices) {}

  async handle(payload: Record<string, unknown>): Promise<void> {
    const { organizationId, periodId, asOf } = payload;
    if (typeof organizationId !== 'string' || typeof periodId !== 'string' || !isEpochMillis(asOf)) {
      throw new Error(`${REPORT_NOTICE_CHECK} payload is missing its organization, its period or its moment.`);
    }
    await this.check.execute({ organizationId, periodId, asOf: new Date(asOf) });
  }
}

const isEpochMillis = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
