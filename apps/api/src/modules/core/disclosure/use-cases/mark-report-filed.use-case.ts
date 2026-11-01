import { isLegalDate } from '@api/contracts/types/time';
import type { ReportFilingStore } from '../interfaces/report-filing-store.interface';
import type { ReportStore } from '../interfaces/report-store.interface';
import { ReportFilingDateInvalidError, ReportNotExportedError, ReportNotFoundError } from '../errors/report.errors';
import type { Report } from '../models/report.model';

export interface MarkReportFiledCommand {
  readonly reportId: string;
  /** The day the reporter says the report was filed — a calendar date, `YYYY-MM-DD`. */
  readonly filedOn: string;
}

/**
 * FR-41's *Mark as filed* (task 47.5; 182/19; §12.5.6's task-47 row (1)–(4)): the reporter's own record that the report
 * has left the building, on the day they say. **Allowed once an export has completed**, and on a locked report as on an
 * open one; unresolved findings gate nothing (182/27).
 *
 * **The date is read in the period's zone** (NFR-34): the reporter states a day, and the day a report was filed is a
 * fact about the filing jurisdiction's calendar, which the period already names. Who marked it and when are the
 * database's, from the request's own binding.
 */
export class MarkReportFiled {
  constructor(
    private readonly reports: Pick<ReportStore, 'findReport'>,
    private readonly filing: ReportFilingStore,
  ) {}

  async execute(command: MarkReportFiledCommand): Promise<Report> {
    const report = await this.reports.findReport({ reportId: command.reportId });
    if (!report) throw new ReportNotFoundError();
    const filedOn = { date: command.filedOn, timezone: report.subject.periodStart.timezone };
    if (!isLegalDate(filedOn)) throw new ReportFilingDateInvalidError();
    if (!(await this.filing.mark({ reportId: command.reportId, filedOn }))) throw new ReportNotExportedError();
    const marked = await this.reports.findReport({ reportId: command.reportId });
    if (!marked) throw new ReportNotFoundError();
    return marked;
  }
}
