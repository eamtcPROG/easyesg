import { Injectable } from '@nestjs/common';
import type { ScopeTotal } from '../domain/scope-total';
import type { CalcRun, StoredCalcRun } from '../models/calc-run.model';
import type { CalcSource, CalcSourceKey } from '../models/calc-source.model';
import type { CalculatorView } from '../models/calculator-view.model';
import type { FactorSet } from '../models/factor-set.model';
import { ExplainFigure } from '../use-cases/explain-figure.use-case';
import { OverrideFigure } from '../use-cases/override-figure.use-case';
import { ReadCalcFigures } from '../use-cases/read-calc-figures.use-case';
import { ReadCalcRun } from '../use-cases/read-calc-run.use-case';
import { ReadCalcSources } from '../use-cases/read-calc-sources.use-case';
import { ReadCalculator } from '../use-cases/read-calculator.use-case';
import { RecordCalcRun } from '../use-cases/record-calc-run.use-case';
import { RemoveCalcSource } from '../use-cases/remove-calc-source.use-case';
import { RestoreFigure } from '../use-cases/restore-figure.use-case';
import { WriteCalcSource, type WriteCalcSourceCommand } from '../use-cases/write-calc-source.use-case';

/**
 * The calculator's application seam (task 38.1) — controllers call this, this calls the use cases (`apps/api/CLAUDE.md`,
 * "Module anatomy"). **It resolves nothing ambient**: who recorded a run is the database's own binding, so there is no
 * actor for a service to forward and none a caller could substitute.
 */
@Injectable()
export class CalculatorService {
  constructor(
    private readonly readCalculator: ReadCalculator,
    private readonly readSources: ReadCalcSources,
    private readonly writeSource: WriteCalcSource,
    private readonly removeSource: RemoveCalcSource,
    private readonly recordRun: RecordCalcRun,
    private readonly readRun: ReadCalcRun,
    private readonly overrideFigure: OverrideFigure,
    private readonly restoreFigure: RestoreFigure,
    private readonly explainFigure: ExplainFigure,
    private readonly readFigures: ReadCalcFigures,
  ) {}

  figures(query: { readonly reportId: string }): ReturnType<ReadCalcFigures['execute']> {
    return this.readFigures.execute(query);
  }

  calculator(query: { readonly reportId: string }): Promise<CalculatorView> {
    return this.readCalculator.execute(query);
  }

  sources(query: { readonly reportId: string }): Promise<CalcSource[]> {
    return this.readSources.execute(query);
  }

  write(command: WriteCalcSourceCommand): Promise<CalcSource> {
    return this.writeSource.execute(command);
  }

  remove(command: CalcSourceKey): Promise<void> {
    return this.removeSource.execute(command);
  }

  run(command: { readonly reportId: string }): Promise<{
    readonly run: CalcRun;
    readonly factorSet: FactorSet;
    readonly scopes: readonly ScopeTotal[];
  }> {
    return this.recordRun.execute(command);
  }

  replay(query: { readonly reportId: string; readonly runId: string }): Promise<{
    readonly run: StoredCalcRun;
    readonly factorSet: FactorSet;
    readonly scopes: readonly ScopeTotal[];
    readonly reproduces: boolean;
  }> {
    return this.readRun.execute(query);
  }

  override(command: Parameters<OverrideFigure['execute']>[0]): Promise<void> {
    return this.overrideFigure.execute(command);
  }

  restore(command: Parameters<RestoreFigure['execute']>[0]): Promise<void> {
    return this.restoreFigure.execute(command);
  }

  explain(command: Parameters<ExplainFigure['execute']>[0]): Promise<void> {
    return this.explainFigure.execute(command);
  }
}
