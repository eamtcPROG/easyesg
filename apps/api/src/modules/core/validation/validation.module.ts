import { Module, type Provider } from '@nestjs/common';
import configuration, { APP_MODE } from '@api/config/configuration';
import { CLOCK, type Clock } from '@api/contracts/clock.port';
import { EntityIdentifiersRepository } from '@api/infrastructure/persistence/core/entity-identifiers.repository';
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
import { REPORTING_ENTITY_RECORD, type ReportingEntityRecord } from './interfaces/reporting-entity.interface';
import { VALIDATION_REPORTS, type ValidationReports } from './interfaces/validation-reports.interface';
import { VALIDATION_RULE_SETS, type ValidationRuleSets } from './interfaces/validation-rule-sets.interface';
import { VALIDATION_STORE, type ValidationStore } from './interfaces/validation-store.interface';
import { ValidationRuleSetCatalog } from './services/validation-rule-set-catalog.service';
import { ValidationService } from './services/validation.service';
import { RunValidation } from './use-cases/run-validation.use-case';
import { NameFindings } from './use-cases/name-findings.use-case';
import { DISCLOSURE_LABELS, type DisclosureLabelResolver } from '@api/contracts/disclosure-label.port';
import { ENTITY_FIELD_NAMES, type EntityFieldNames } from '@api/contracts/entity-field-names.port';
import { LocalizationModule } from '@api/modules/platform/localization/localization.module';

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
 * - **Task 210 brings the entity's record into a run** — its IDNO, read through `REPORTING_ENTITY_RECORD` by the query
 *   the Excel export writes it from, so FR-16's *no filing without an IDNO* is a seeded rule like any other.
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
  { provide: REPORTING_ENTITY_RECORD, useClass: EntityIdentifiersRepository },
  {
    provide: RunValidation,
    inject: [
      VALIDATION_REPORTS,
      EVALUATION_SCOPES,
      PRIOR_COMPARABLES,
      REPORTING_ENTITY_RECORD,
      VALIDATION_RULE_SETS,
      VALIDATION_STORE,
      CLOCK,
    ],
    useFactory: (
      reports: ValidationReports,
      scopes: EvaluationScopes,
      priors: PriorComparables,
      entities: ReportingEntityRecord,
      ruleSets: ValidationRuleSets,
      store: ValidationStore,
      now: Clock,
    ) => new RunValidation(reports, scopes, priors, entities, ruleSets, store, now),
  },
];

/**
 * The request tier names what a run or a read found for its reader (task 42.2): the labels of the version the report
 * pins, which `LocalizationModule` provides in both modes and only the HTTP answer reads — and since task 210 the
 * api's own names for the fields the entity's record answers.
 */
const httpProviders: Provider[] = [
  ValidationService,
  ...runProviders,
  {
    provide: NameFindings,
    inject: [DISCLOSURE_LABELS, ENTITY_FIELD_NAMES],
    useFactory: (labels: DisclosureLabelResolver, entityFields: EntityFieldNames) => new NameFindings(labels, entityFields),
  },
];

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
  // `LocalizationModule` for the labels a finding's field is named by (task 42.2), and since task 210 the names of the
  // fields the entity's record answers.
  imports: [DisclosureModule, ComparativesModule, NotificationModule, LocalizationModule],
  controllers: mode === APP_MODE.WORKER ? [] : [ValidationController],
  providers: [
    { provide: VALIDATION_RULE_SETS, useClass: ValidationRuleSetCatalog },
    ...(mode === APP_MODE.WORKER ? workerProviders : httpProviders),
  ],
  // Since task 43.1 the run's read too: the preview prints the last run's unresolved findings (UX-119), and task 44's
  // export on the worker will — `RunValidation` is registered in both modes. Since task 47.4 the HTTP side's service as
  // well: an export request runs validation and refuses with the findings named as S-08 names them (182/20).
  exports: [VALIDATION_RULE_SETS, RunValidation, ...(mode === APP_MODE.WORKER ? [] : [ValidationService])],
})
export class ValidationModule {}
