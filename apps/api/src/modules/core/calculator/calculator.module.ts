import { Module, type Provider } from '@nestjs/common';
import configuration, { APP_MODE } from '@api/config/configuration';
import { NOTIFICATION_PORT, type NotificationPort } from '@api/contracts/notification.port';
import { TAXONOMY_REGISTRY, type TaxonomyRegistry } from '@api/contracts/taxonomy-registry.port';
import { TENANT_WORK, type TenantWork } from '@api/contracts/tenant-work.port';
import { CalcReportsRepository } from '@api/infrastructure/persistence/core/calc-reports.repository';
import { CalcRunStoreRepository } from '@api/infrastructure/persistence/core/calc-run-store.repository';
import { CalcSourceStoreRepository } from '@api/infrastructure/persistence/core/calc-source-store.repository';
import { FactorSetUsersRepository } from '@api/infrastructure/persistence/core/factor-set-users.repository';
import { ReportUpdateAudienceRepository } from '@api/infrastructure/persistence/core/report-update-audience.repository';
import { WorkerTenantWork } from '@api/infrastructure/persistence/worker-tenant-work';
import { DisclosureModule } from '@api/modules/core/disclosure/disclosure.module';
import {
  CALCULATED_FIGURES,
  type CalculatedFigures,
} from '@api/modules/core/disclosure/interfaces/calculated-figures.interface';
import { NotificationModule } from '@api/modules/platform/notification/notification.module';
import { TaxonomyModule } from '@api/modules/platform/taxonomy/taxonomy.module';
import { FactorSetReplacedHandler } from './consumers/factor-set-replaced.handler';
import { CalculatorController } from './controllers/calculator.controller';
import { CALC_REPORTS, type CalcReports } from './interfaces/calc-report.interface';
import { CALC_RUN_STORE, type CalcRunStore } from './interfaces/calc-run-store.interface';
import { CALC_SOURCE_STORE, type CalcSourceStore } from './interfaces/calc-source-store.interface';
import { FACTOR_SET_USERS, type FactorSetUsers } from './interfaces/factor-set-users.interface';
import { FACTOR_SETS, type FactorSets } from './interfaces/factor-sets.interface';
import { REPORT_UPDATE_AUDIENCE, type ReportUpdateAudience } from './interfaces/report-update-audience.interface';
import { CalculatorService } from './services/calculator.service';
import { FactorSetCatalog } from './services/factor-set-catalog.service';
import { ExplainFigure } from './use-cases/explain-figure.use-case';
import { NotifyFactorSetReplaced } from './use-cases/notify-factor-set-replaced.use-case';
import { OverrideFigure } from './use-cases/override-figure.use-case';
import { ReadCalcRun } from './use-cases/read-calc-run.use-case';
import { ReadCalcSources } from './use-cases/read-calc-sources.use-case';
import { RecordCalcRun } from './use-cases/record-calc-run.use-case';
import { RemoveCalcSource } from './use-cases/remove-calc-source.use-case';
import { RestoreFigure } from './use-cases/restore-figure.use-case';
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
 * arithmetic is 38.2's and 38.3's (`domain/`), and since 38.4 a run computes, stores and writes its results into B3 and
 * a recorded run reads back computed again against its pinned set.
 *
 * **The use cases are `useFactory` + `inject`** — `identity/account`'s shape, since they carry no `@Injectable`. The
 * catalog stays `useClass`: it is an adapter over infrastructure, `TaxonomyModule`'s reason.
 *
 * **`FACTOR_SETS` is registered in both modes**, like the store it reads: the worker renders exports, every export
 * names the factor-set version its figures used (NFR-22), and a catalog only the HTTP tier held would leave the worker
 * unable to read a pin. **The lines and runs are the HTTP tier's alone.** **The worker's one job is FR-166's factor
 * half** (task 37.3): a factor set replaced in its window, announced by the publisher on the outbox, tells each
 * organization with an open report calculated on it — through `TENANT_WORK`, one organization's transaction at a time.
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
    inject: [CALC_REPORTS, CALC_RUN_STORE, FACTOR_SETS, CALCULATED_FIGURES],
    useFactory: (reports: CalcReports, runs: CalcRunStore, factorSets: FactorSets, figures: CalculatedFigures) =>
      new RecordCalcRun(reports, runs, factorSets, figures),
  },
  {
    provide: ReadCalcRun,
    inject: [CALC_RUN_STORE, FACTOR_SETS],
    useFactory: (runs: CalcRunStore, factorSets: FactorSets) => new ReadCalcRun(runs, factorSets),
  },
  {
    provide: OverrideFigure,
    inject: [CALC_REPORTS, CALCULATED_FIGURES],
    useFactory: (reports: CalcReports, figures: CalculatedFigures) => new OverrideFigure(reports, figures),
  },
  {
    provide: RestoreFigure,
    inject: [CALC_REPORTS, CALC_RUN_STORE, CALCULATED_FIGURES],
    useFactory: (reports: CalcReports, runs: CalcRunStore, figures: CalculatedFigures) =>
      new RestoreFigure(reports, runs, figures),
  },
  {
    provide: ExplainFigure,
    inject: [CALC_REPORTS, CALCULATED_FIGURES],
    useFactory: (reports: CalcReports, figures: CalculatedFigures) => new ExplainFigure(reports, figures),
  },
];

/**
 * FR-166's factor half on the worker (task 37.3): the job, its use case, the unbound read of who used a revision, the
 * bound read of each organization's reports and editors, and the unit of work that binds it.
 */
const workerProviders: Provider[] = [
  { provide: FACTOR_SET_USERS, useClass: FactorSetUsersRepository },
  { provide: REPORT_UPDATE_AUDIENCE, useClass: ReportUpdateAudienceRepository },
  { provide: TENANT_WORK, useClass: WorkerTenantWork },
  {
    provide: NotifyFactorSetReplaced,
    inject: [FACTOR_SET_USERS, REPORT_UPDATE_AUDIENCE, FACTOR_SETS, TENANT_WORK, NOTIFICATION_PORT],
    useFactory: (
      users: FactorSetUsers,
      audience: ReportUpdateAudience,
      factorSets: FactorSets,
      tenantWork: TenantWork,
      notifications: NotificationPort,
    ) => new NotifyFactorSetReplaced(users, audience, factorSets, tenantWork, notifications),
  },
  FactorSetReplacedHandler,
];

@Module({
  // `NotificationModule` for `NOTIFICATION_PORT` on the worker (task 37.3), which the factor notice raises through.
  // `DisclosureModule` for `CALCULATED_FIGURES` (task 38.4): a run's figures arrive in B3 through that module's own
  // write rule — written as calculated, an earlier run's cleared, the total and intensity recomputed — not through its
  // store, which would be a second copy of the rule.
  imports: [TaxonomyModule, DisclosureModule, NotificationModule],
  controllers: mode === APP_MODE.WORKER ? [] : [CalculatorController],
  providers: [
    { provide: FACTOR_SETS, useClass: FactorSetCatalog },
    ...(mode === APP_MODE.WORKER ? workerProviders : httpProviders),
  ],
  exports: [FACTOR_SETS],
})
export class CalculatorModule {}
