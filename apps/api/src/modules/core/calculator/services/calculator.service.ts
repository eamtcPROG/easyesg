import { Injectable } from '@nestjs/common';
import type { CalcRun } from '../models/calc-run.model';
import type { CalcSource, CalcSourceKey } from '../models/calc-source.model';
import type { FactorSet } from '../models/factor-set.model';
import { ReadCalcSources } from '../use-cases/read-calc-sources.use-case';
import { RecordCalcRun } from '../use-cases/record-calc-run.use-case';
import { RemoveCalcSource } from '../use-cases/remove-calc-source.use-case';
import { WriteCalcSource, type WriteCalcSourceCommand } from '../use-cases/write-calc-source.use-case';

/**
 * The calculator's application seam (task 38.1) — controllers call this, this calls the use cases (`apps/api/CLAUDE.md`,
 * "Module anatomy"). **It resolves nothing ambient**: who recorded a run is the database's own binding, so there is no
 * actor for a service to forward and none a caller could substitute.
 */
@Injectable()
export class CalculatorService {
  constructor(
    private readonly readSources: ReadCalcSources,
    private readonly writeSource: WriteCalcSource,
    private readonly removeSource: RemoveCalcSource,
    private readonly recordRun: RecordCalcRun,
  ) {}

  sources(query: { readonly reportId: string }): Promise<CalcSource[]> {
    return this.readSources.execute(query);
  }

  write(command: WriteCalcSourceCommand): Promise<CalcSource> {
    return this.writeSource.execute(command);
  }

  remove(command: CalcSourceKey): Promise<void> {
    return this.removeSource.execute(command);
  }

  run(command: { readonly reportId: string }): Promise<{ readonly run: CalcRun; readonly factorSet: FactorSet }> {
    return this.recordRun.execute(command);
  }
}
