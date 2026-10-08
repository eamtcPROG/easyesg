import { Module, type Provider } from '@nestjs/common';
import configuration, { APP_MODE } from '@api/config/configuration';
import { CLOCK, type Clock } from '@api/contracts/clock.port';
import { ValidationReportsRepository } from '@api/infrastructure/persistence/core/validation-reports.repository';
import { ValidationStoreRepository } from '@api/infrastructure/persistence/core/validation-store.repository';
import { ComparativesModule } from '@api/modules/core/comparatives/comparatives.module';
import { ReadPriorPeriodValues } from '@api/modules/core/comparatives/use-cases/read-prior-period-values.use-case';
import { DisclosureModule } from '@api/modules/core/disclosure/disclosure.module';
import { ReadWizardStep } from '@api/modules/core/disclosure/use-cases/read-wizard-step.use-case';
import { NOTIFICATION_CADENCES, type NotificationCadences } from '@api/contracts/notification-cadence.port';
import { NOTIFICATION_PORT, type NotificationPort } from '@api/contracts/notification.port';
import { TENANT_WORK, type TenantWork } from '@api/contracts/tenant-work.port';
import { NoticePeriodsRepository } from '@api/infrastructure/persistence/core/notice-periods.repository';
import { ReportNoticeChecksRepository } from '@api/infrastructure/persistence/core/report-notice-checks.repository';
import { ReportNoticeDirectoryRepository } from '@api/infrastructure/persistence/core/report-notice-directory.repository';
import { WorkerTenantWork } from '@api/infrastructure/persistence/worker-tenant-work';
import { NotificationModule } from '@api/modules/platform/notification/notification.module';
import { ReportNoticeCheckHandler } from './consumers/report-notice-check.handler';
import { ReportNoticeSweepHandler } from './consumers/report-notice-sweep.handler';
import { NOTICE_CHECKS, type NoticeChecks } from './interfaces/notice-checks.interface';
import { NOTICE_DIRECTORY, type NoticeDirectory } from './interfaces/notice-directory.interface';
import { NOTICE_PERIODS, type NoticePeriods } from './interfaces/notice-periods.interface';
import { CheckReportNotices } from './use-cases/check-report-notices.use-case';
import { SweepReportNotices } from './use-cases/sweep-report-notices.use-case';
import { ValidationController } from './controllers/validation.controller';
import { comparablePrior } from './domain/comparable-prior';
import { EVALUATION_SCOPES, type EvaluationScopes } from './interfaces/evaluation-scopes.interface';
import { PRIOR_COMPARABLES, type PriorComparables } from './interfaces/prior-comparables.interface';
import { VALIDATION_REPORTS, type ValidationReports } from './interfaces/validation-reports.interface';
import { VALIDATION_RULE_SETS, type ValidationRuleSets } from './interfaces/validation-rule-sets.interface';
import { VALIDATION_STORE, type ValidationStore } from './interfaces/validation-store.interface';
import { ValidationRuleSetCatalog } from './services/validation-rule-set-catalog.service';
import { ValidationService } from './services/validation.service';
import { RunValidation } from './use-cases/run-validation.use-case';

/**
 * `core/validation` — FR-40 … FR-44, FR-73
 *
 * The rule interpreter (`@easyesg/validation`, task 40) over the rule set the configuration store holds (AD-4), never
 * over hardcoded checks.
 *
 * - **Task 41.1 brings the set in force** — `VALIDATION_RULE_SETS`, read as at a day or by the revision a lock pinned,
 *   through the package's own reader. The configuration store refuses a set that reader would not read, or whose message
 *   no locale words, before it is written (`configuration-kind-rules.ts`). Registered in both modes, like the store it
 *   reads, and exported: a lock pins the set in force (`PeriodModule`).
 * - **Task 41.2 brings the run and its findings** — `POST /reports/{id}/validation/runs` and `GET /reports/{id}/validation`,
 *   on the request tier. The report's scope is `core/disclosure`'s (`WizardService.evaluationScope`) and the prior
 *   period's values `core/comparatives`' (`ReadPriorPeriodValues`), each read through a port of this module's own, so the
 *   use case knows neither module.
 * - **Task 51.2 brings the notices' schedule** — on the worker, a daily sweep and a check per period that owes one,
 *   each check a validation run stored as the platform's, then FR-164's and FR-165's notices raised or withdrawn. An
 *   export request (47.4) will evaluate there too.
 *
 * Boundary: `modules/core/**` and `modules/billing/**` may not import each other.
 * Both may import `contracts/**`. Enforced by dependency-cruiser, not by review.
 */
const { mode } = configuration();

/**
 * A validation run and what it reads — **both modes** since task 51.2: the request tier runs one when asked, and a
 * scheduled check runs one on the worker (§12.5.6's task-51.2 row (3)). The scope is the wizard's own read
 * (`ReadWizardStep`), which `DisclosureModule` registers in both, and the prior period's values `ComparativesModule`'s.
 */
const runProviders: Provider[] = [
  { provide: CLOCK, useValue: () => new Date() },
  { provide: VALIDATION_STORE, useClass: ValidationStoreRepository },
  { provide: VALIDATION_REPORTS, useClass: ValidationReportsRepository },
  {
    provide: EVALUATION_SCOPES,
    inject: [ReadWizardStep],
    useFactory: (reads: ReadWizardStep): EvaluationScopes => ({
      evaluationScope: (query) => reads.evaluationScope(query),
    }),
  },
  {
    provide: PRIOR_COMPARABLES,
    inject: [ReadPriorPeriodValues],
    useFactory: (comparatives: ReadPriorPeriodValues): PriorComparables => ({
      comparable: async (query) => comparablePrior((await comparatives.read(query)).values),
    }),
  },
  {
    provide: RunValidation,
    inject: [VALIDATION_REPORTS, EVALUATION_SCOPES, PRIOR_COMPARABLES, VALIDATION_RULE_SETS, VALIDATION_STORE, CLOCK],
    useFactory: (
      reports: ValidationReports,
      scopes: EvaluationScopes,
      priors: PriorComparables,
      ruleSets: ValidationRuleSets,
      store: ValidationStore,
      now: Clock,
    ) => new RunValidation(reports, scopes, priors, ruleSets, store, now),
  },
];

const httpProviders: Provider[] = [ValidationService, ...runProviders];

/**
 * FR-164's and FR-165's notices on the worker (task 51.2): the day's sweep, which `ScheduleTicker` starts at its slot,
 * the unbound directory it reads and the rows it schedules, and each period's check — bound by `TENANT_WORK`, running
 * the same `RunValidation` the request tier runs, and raising through `NOTIFICATION_PORT`.
 */
const workerProviders: Provider[] = [
  ...runProviders,
  { provide: TENANT_WORK, useClass: WorkerTenantWork },
  { provide: NOTICE_DIRECTORY, useClass: ReportNoticeDirectoryRepository },
  { provide: NOTICE_CHECKS, useClass: ReportNoticeChecksRepository },
  { provide: NOTICE_PERIODS, useClass: NoticePeriodsRepository },
  {
    provide: SweepReportNotices,
    inject: [NOTICE_DIRECTORY, NOTIFICATION_CADENCES, NOTICE_CHECKS],
    useFactory: (directory: NoticeDirectory, cadences: NotificationCadences, checks: NoticeChecks) =>
      new SweepReportNotices(directory, cadences, checks),
  },
  {
    provide: CheckReportNotices,
    inject: [NOTICE_PERIODS, RunValidation, NOTIFICATION_CADENCES, TENANT_WORK, NOTIFICATION_PORT],
    useFactory: (
      periods: NoticePeriods,
      validation: RunValidation,
      cadences: NotificationCadences,
      tenantWork: TenantWork,
      notifications: NotificationPort,
    ) => new CheckReportNotices(periods, validation, cadences, tenantWork, notifications),
  },
  ReportNoticeSweepHandler,
  ReportNoticeCheckHandler,
];

@Module({
  // `NotificationModule` for the cadence the notices keep and the port they raise through (task 51.2).
  imports: [DisclosureModule, ComparativesModule, NotificationModule],
  controllers: mode === APP_MODE.WORKER ? [] : [ValidationController],
  providers: [
    { provide: VALIDATION_RULE_SETS, useClass: ValidationRuleSetCatalog },
    ...(mode === APP_MODE.WORKER ? workerProviders : httpProviders),
  ],
  exports: [VALIDATION_RULE_SETS],
})
export class ValidationModule {}
