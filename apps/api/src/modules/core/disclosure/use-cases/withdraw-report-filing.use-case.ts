import type { ReportFilingStore } from '../interfaces/report-filing-store.interface';
import type { ReportStore } from '../interfaces/report-store.interface';
import { ReportNotFoundError } from '../errors/report.errors';
import type { Report } from '../models/report.model';

/**
 * Withdraws FR-41's filed mark (task 47.5; §12.5.6's task-47 row (3)) — **by whoever may make one, with no reason**:
 * the change trail records who and when, and a mistaken mark with no way back would be a trap, revisions having no
 * requirement. Withdrawing an unmarked report changes nothing and answers it as it stands.
 */
export class WithdrawReportFiling {
  constructor(
    private readonly reports: Pick<ReportStore, 'findReport'>,
    private readonly filing: ReportFilingStore,
  ) {}

  async execute(command: { readonly reportId: string }): Promise<Report> {
    if (!(await this.filing.withdraw(command))) throw new ReportNotFoundError();
    const report = await this.reports.findReport(command);
    if (!report) throw new ReportNotFoundError();
    return report;
  }
}
