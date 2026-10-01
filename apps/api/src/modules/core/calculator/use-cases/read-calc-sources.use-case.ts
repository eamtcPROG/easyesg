import { ReportNotFoundError } from '@api/modules/core/disclosure/errors/report.errors';
import type { CalcReports } from '../interfaces/calc-report.interface';
import type { CalcSourceStore } from '../interfaces/calc-source-store.interface';
import type { CalcSource } from '../models/calc-source.model';

/**
 * A report's invoice lines, as S-09 lists them (task 38.1; UX-41: the raw inputs stay visible as the record they are).
 *
 * The report is found first so an unknown or foreign report answers *not found* rather than an empty list: an empty
 * list is a real answer — a report with nothing entered yet — and must not be the one RLS gives a stranger.
 */
export class ReadCalcSources {
  constructor(
    private readonly reports: CalcReports,
    private readonly sources: CalcSourceStore,
  ) {}

  async execute(query: { readonly reportId: string }): Promise<CalcSource[]> {
    const report = await this.reports.find({ reportId: query.reportId });
    if (report === null) throw new ReportNotFoundError();
    return this.sources.forReport({ reportId: query.reportId });
  }
}
