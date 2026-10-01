import { Module, type Provider } from '@nestjs/common';
import configuration, { APP_MODE } from '@api/config/configuration';
import { TAXONOMY_REGISTRY, type TaxonomyRegistry } from '@api/contracts/taxonomy-registry.port';
import { CalcReportsRepository } from '@api/infrastructure/persistence/core/calc-reports.repository';
import { CalcRunStoreRepository } from '@api/infrastructure/persistence/core/calc-run-store.repository';
import { CalcSourceStoreRepository } from '@api/infrastructure/persistence/core/calc-source-store.repository';
import { TaxonomyModule } from '@api/modules/platform/taxonomy/taxonomy.module';
import { CalculatorController } from './controllers/calculator.controller';
import { CALC_REPORTS, type CalcReports } from './interfaces/calc-report.interface';
import { CALC_RUN_STORE, type CalcRunStore } from './interfaces/calc-run-store.interface';
import { CALC_SOURCE_STORE, type CalcSourceStore } from './interfaces/calc-source-store.interface';
import { FACTOR_SETS, type FactorSets } from './interfaces/factor-sets.interface';
import { CalculatorService } from './services/calculator.service';
import { FactorSetCatalog } from './services/factor-set-catalog.service';
import { ReadCalcSources } from './use-cases/read-calc-sources.use-case';
import { RecordCalcRun } from './use-cases/record-calc-run.use-case';
import { RemoveCalcSource } from './use-cases/remove-calc-source.use-case';
import { WriteCalcSource } from './use-cases/write-calc-source.use-case';

/**
 * `core/calculator` — FR-33 … FR-36
 *
 * Scope 1 + location-based Scope 2. Raw inputs retained permanently; results pinned to a factor-set version.
 *
 * Boundary: `modules/core/**` and `modules/billing/**` may not import each other.
 * Both may import `contracts/**`. Enforced by dependency-cruiser, not by review.
 *
 * **Task 37 built the factor half**: the sets as configuration (`config/seed/emission-factor-set.<country>.json`) and
 * `FACTOR_SETS`, the read a run pins to. **Task 38.1 adds the inputs**: a report's invoice lines as its working set
 * (`core.calc_source`) and the runs that retain them (`core.calc_run`, `core.calc_input`), behind `CalculatorController`. The
 * arithmetic and the write into B3 are 38.2 … 38.4's, over the runs recorded here.
 *
 * **The use cases are `useFactory` + `inject`** — `identity/account`'s shape, since they carry no `@Injectable`. The
 * catalog stays `useClass`: it is an adapter over infrastructure, `TaxonomyModule`'s reason.
 *
 * **`FACTOR_SETS` is registered in both modes**, like the store it reads: the worker renders exports, every export
 * names the factor-set version its figures used (NFR-22), and a catalog only the HTTP tier held would leave the worker
 * unable to read a pin. **The lines and runs are the HTTP tier's alone** — no outbox job routes here yet.
 */
const { mode } = configuration();

const httpProviders: Provider[] = [
  CalculatorService,
  { provide: CALC_REPORTS, useClass: CalcReportsRepository },
  { provide: CALC_SOURCE_STORE, useClass: CalcSourceStoreRepository },
  { provide: CALC_RUN_STORE, useClass: CalcRunStoreRepository },
  {
    provide: ReadCalcSources,
    inject: [CALC_REPORTS, CALC_SOURCE_STORE],
    useFactory: (reports: CalcReports, sources: CalcSourceStore) => new ReadCalcSources(reports, sources),
  },
  {
    provide: WriteCalcSource,
    inject: [CALC_REPORTS, CALC_SOURCE_STORE, FACTOR_SETS, TAXONOMY_REGISTRY],
    useFactory: (reports: CalcReports, sources: CalcSourceStore, factorSets: FactorSets, taxonomy: TaxonomyRegistry) =>
      new WriteCalcSource(reports, sources, factorSets, taxonomy),
  },
  {
    provide: RemoveCalcSource,
    inject: [CALC_REPORTS, CALC_SOURCE_STORE],
    useFactory: (reports: CalcReports, sources: CalcSourceStore) => new RemoveCalcSource(reports, sources),
  },
  {
    provide: RecordCalcRun,
    inject: [CALC_REPORTS, CALC_RUN_STORE, FACTOR_SETS],
    useFactory: (reports: CalcReports, runs: CalcRunStore, factorSets: FactorSets) =>
      new RecordCalcRun(reports, runs, factorSets),
  },
];

@Module({
  imports: [TaxonomyModule],
  controllers: mode === APP_MODE.WORKER ? [] : [CalculatorController],
  providers: [
    { provide: FACTOR_SETS, useClass: FactorSetCatalog },
    ...(mode === APP_MODE.WORKER ? [] : httpProviders),
  ],
  exports: [FACTOR_SETS],
})
export class CalculatorModule {}
