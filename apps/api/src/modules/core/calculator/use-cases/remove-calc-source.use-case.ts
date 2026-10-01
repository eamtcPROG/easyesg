import { ReportNotFoundError } from '@api/modules/core/disclosure/errors/report.errors';
import type { CalcReports } from '../interfaces/calc-report.interface';
import type { CalcSourceStore } from '../interfaces/calc-source-store.interface';
import type { CalcSourceKey } from '../models/calc-source.model';

/**
 * Remove an invoice line from the working set (task 38.1; UC-32, UX-41).
 *
 * **A run that already read the line keeps it** — the run's copy is its own row (P-11), so removing a line changes what
 * the next calculation reads and nothing a recorded one rests on. Removing a line that is not there answers the same
 * as removing one that is: the caller's intended end state, and FR-38's replayed request must not fail.
 */
export class RemoveCalcSource {
  constructor(
    private readonly reports: CalcReports,
    private readonly sources: CalcSourceStore,
  ) {}

  async execute(command: CalcSourceKey): Promise<void> {
    const report = await this.reports.find({ reportId: command.reportId });
    if (report === null) throw new ReportNotFoundError();
    await this.sources.remove(command);
  }
}
