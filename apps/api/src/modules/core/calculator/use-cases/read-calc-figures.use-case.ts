import { ReportNotFoundError } from '@api/modules/core/disclosure/errors/report.errors';
import type { CalcReports } from '../interfaces/calc-report.interface';
import type { CalcRunStore } from '../interfaces/calc-run-store.interface';
import type { FactorSets } from '../interfaces/factor-sets.interface';
import type { LatestCalcRun } from '../models/calc-run.model';
import type { FactorSet } from '../models/factor-set.model';

/**
 * The figures B3 took from the calculator, as S-07 shows them beside the fields they answer (task 39.3; UC-34, UX-43):
 * the report's latest run — what it stored for each scope, the set it pinned and when — so an overridden scope can show
 * **the computed figure it superseded beside the substituted one**, which UX-43 requires and the field itself does not
 * hold. The superseded figure is the run's stored result, retained permanently (§12.5.6's task-38.4 row (4)), so
 * nothing was copied to keep it and this reads it where it is.
 *
 * **Its own read, not S-09's**: B3's step needs the run and nothing of the lines, the sites or the working figures.
 */
export class ReadCalcFigures {
  constructor(
    private readonly reports: CalcReports,
    private readonly runs: CalcRunStore,
    private readonly factorSets: FactorSets,
  ) {}

  async execute(query: { readonly reportId: string }): Promise<{
    readonly latestRun: (LatestCalcRun & { readonly pinned: FactorSet | null }) | null;
  }> {
    const report = await this.reports.find({ reportId: query.reportId });
    if (report === null) throw new ReportNotFoundError();
    const latest = await this.runs.latest({ reportId: query.reportId });
    return { latestRun: latest === null ? null : { ...latest, pinned: await this.factorSets.pinned(latest.factorSet) } };
  }
}
