import { Logger, Module, type Provider } from '@nestjs/common';
import configuration, { APP_MODE } from '@api/config/configuration';
import { CLOCK, type Clock } from '@api/contracts/clock.port';
import { DerivationInputStoreRepository } from '@api/infrastructure/persistence/core/derivation-input-store.repository';
import { DisclosureValueStoreRepository } from '@api/infrastructure/persistence/core/disclosure-value-store.repository';
import { randomUUID } from 'node:crypto';
import { NOTIFICATION_PORT, type NotificationPort } from '@api/contracts/notification.port';
import { ReminderPartiesRepository } from '@api/infrastructure/persistence/core/reminder-parties.repository';
import { ReportStoreRepository } from '@api/infrastructure/persistence/core/report-store.repository';
import { ReportingPeriodStoreRepository } from '@api/infrastructure/persistence/core/reporting-period-store.repository';
import {
  REPORTING_PERIOD_STORE,
  type ReportingPeriodStore,
} from '@api/modules/core/period/interfaces/reporting-period-store.interface';
import { DISCLOSURE_LABELS, type DisclosureLabelResolver } from '@api/contracts/disclosure-label.port';
import { TAXONOMY_REGISTRY, type TaxonomyRegistry } from '@api/contracts/taxonomy-registry.port';
import { ORGANIZATION_VOCABULARY } from '@api/modules/core/organization/interfaces/organization-vocabulary.interface';
import { OrganizationModule } from '@api/modules/core/organization/organization.module';
import { LocalizationModule } from '@api/modules/platform/localization/localization.module';
import { NotificationModule } from '@api/modules/platform/notification/notification.module';
import { TaxonomyModule } from '@api/modules/platform/taxonomy/taxonomy.module';
import { TraceModule } from '../trace/trace.module';
import { ReportsController } from './controllers/reports.controller';
import { WizardController } from './controllers/wizard.controller';
import { AXIS_SHAPES, type AxisShapes } from './interfaces/axis-shape.interface';
import { AxisShapeService } from './services/axis-shape.service';
import { DerivationCalculator } from './services/derivation-calculator.service';
import { DerivationService } from './services/derivation.service';
import { TemplateDefaultService } from './services/template-default.service';
import {
  APPLICABILITY_RULES,
  type ApplicabilityRules,
} from './interfaces/applicability-rules.interface';
import {
  DISCLOSURE_VALUE_STORE,
  type DisclosureValueStore,
} from './interfaces/disclosure-value-store.interface';
import {
  DERIVATION_INPUT_STORE,
  type DerivationInputStore,
} from './interfaces/derivation-input-store.interface';
import {
  DERIVATIONS,
  DERIVATION_RECALCULATOR,
  type DerivationRecalculator,
  type Derivations,
} from './interfaces/derivation.interface';
import {
  TEMPLATE_DEFAULTS,
  type TemplateDefaults,
} from './interfaces/template-default.interface';
import { CALCULATED_FIGURES } from './interfaces/calculated-figures.interface';
import { REMINDER_PARTIES, type ReminderParties } from './interfaces/reminder-parties.interface';
import { REPORT_STORE, type ReportStore } from './interfaces/report-store.interface';
import { ApplicabilityRulesService } from './services/applicability-rules.service';
import { DisclosureFacade } from './services/disclosure-facade.service';
import { ReportService } from './services/report.service';
import { MarkReportFiled } from './use-cases/mark-report-filed.use-case';
import { WithdrawReportFiling } from './use-cases/withdraw-report-filing.use-case';
import { DeleteReport } from './use-cases/delete-report.use-case';
import { REPORT_DELETION_STORE, type ReportDeletionStore } from './interfaces/report-deletion.interface';
import { ReportFilingController } from './controllers/report-filing.controller';
import { REPORT_FILING_STORE, type ReportFilingStore } from './interfaces/report-filing-store.interface';
import { ReportFilingStoreRepository } from '@api/infrastructure/persistence/core/report-filing-store.repository';
import { ReportDeletionStoreRepository } from '@api/infrastructure/persistence/core/report-deletion-store.repository';
import { WizardService } from './services/wizard.service';
import { CreateReport } from './use-cases/create-report.use-case';
import { SendReportReminder } from './use-cases/send-report-reminder.use-case';
import { ReadWizardStep, type WizardVocabulary } from './use-cases/read-wizard-step.use-case';
import { OMISSION_SECTIONS, type OmissionSections } from './interfaces/omission-sections.interface';
import { OmissionSectionsService } from './services/omission-sections.service';
import { CalculatedFiguresService } from './services/calculated-figures.service';
import { ExplainCalculatedFigure } from './use-cases/explain-calculated-figure.use-case';
import { OverrideCalculatedFigure } from './use-cases/override-calculated-figure.use-case';
import { RestoreCalculatedFigure } from './use-cases/restore-calculated-figure.use-case';
import { WriteCalculatedFigures } from './use-cases/write-calculated-figures.use-case';
import { WriteDerivationInputs } from './use-cases/write-derivation-inputs.use-case';
import { WriteDisclosureValues } from './use-cases/write-disclosure-values.use-case';
import { LastRunOutstandingRepository } from '@api/infrastructure/persistence/core/last-run-outstanding.repository';
import { LAST_RUN_OUTSTANDING, type LastRunOutstanding } from './interfaces/last-run-outstanding.interface';
import { ClearOutstandingNotice } from './use-cases/clear-outstanding-notice.use-case';

/**
 * `core/disclosure` — FR-24 … FR-32, FR-177
 *
 * Taxonomy-keyed disclosure store (AD-3). The element key IS the VSME XBRL element local name.
 *
 * Since task 31.3 it also owns **the report itself** — `core.report`, its lifecycle and DR-4's
 * version pin. That is §17.5's allocation rather than a choice made here: this module holds
 * FR-24 … FR-32, and §7's own component table lists `core.report` beside
 * `core.report_disclosure_value` under the Disclosure Store.
 *
 * Boundary: `modules/core/**` and `modules/billing/**` may not import each other.
 * Both may import `contracts/**`. Enforced by dependency-cruiser, not by review.
 *
 * **It provides `REPORTING_PERIOD_STORE` itself**, following `EntityModule` and `PeriodModule`'s
 * pattern for their stated reason: creating a report reads the period to copy its pin and to refuse
 * a locked one, and importing `PeriodModule` would pull in its controllers and give this module a
 * dependency on routes it never calls. The repository is a stateless adapter over the request
 * transaction, so a second registration is a second reference to the same behaviour — which is the
 * distinction `PeriodModule` draws against the taxonomy registry, whose cache must not be doubled.
 *
 * **On the worker, the wizard's read alone** (task 51.2): a scheduled check evaluates a report's scope through
 * `ReadWizardStep`, which `evaluationProviders` registers in both modes. No outbox job routes to this module; creating
 * a report is synchronous and emits no notification of its own. **A reminder raises one** (task 50.3), on the
 * request's transaction through `NotificationModule`'s port, and the worker's notification consumer delivers it.
 */
const { mode } = configuration();

/**
 * The wizard's read and everything under it — what a report's evaluation scope is computed from (task 51.2). **Both
 * modes**: the request tier reads steps through it, and since task 51.2 a scheduled check on the worker evaluates a
 * report through `ReadWizardStep.evaluationScope`, as a validation run on the request tier does through `WizardService`.
 * Every member is a stateless adapter over the request's transaction or a reader over the configuration store, so a
 * worker job bound by `TENANT_WORK` reads its tenant exactly as a request does.
 */
const evaluationProviders: Provider[] = [
  { provide: REPORT_STORE, useClass: ReportStoreRepository },
  // Task 34.1's store. Provided and exported with no use case above it yet: the wizard that writes
  // through it is task 36 and the typed facade is 34.2, so what exists here is the adapter and the
  // guarantees under it. Registering it now is what makes those guarantees testable against the real
  // schema rather than described — `disclosure-value.e2e-spec.ts` is the proof.
  { provide: DISCLOSURE_VALUE_STORE, useClass: DisclosureValueStoreRepository },
  // Task 91.3's rules. `useClass` rather than a factory, like the taxonomy registry it sits beside:
  // it is an adapter over the configuration store — reads, validates and caches per revision — and
  // no framework-free use case owns it. The port is not exported: FR-28 belongs to this module
  // (§17.5), and a consumer elsewhere would be evaluating a report's shape from outside the module
  // that holds its values.
  { provide: APPLICABILITY_RULES, useClass: ApplicabilityRulesService },
  { provide: AXIS_SHAPES, useClass: AxisShapeService },
  // Task 41.2's sections: which elements each section B1's omission list offers withholds (FR-31 AC-3). Beside the
  // applicability rules, for their reason — an adapter over the store that validates and caches per revision.
  { provide: OMISSION_SECTIONS, useClass: OmissionSectionsService },
  {
    provide: ReadWizardStep,
    inject: [
      REPORT_STORE,
      DISCLOSURE_VALUE_STORE,
      TAXONOMY_REGISTRY,
      DISCLOSURE_LABELS,
      ORGANIZATION_VOCABULARY,
      APPLICABILITY_RULES,
      AXIS_SHAPES,
      DERIVATIONS,
      DERIVATION_INPUT_STORE,
      TEMPLATE_DEFAULTS,
      OMISSION_SECTIONS,
    ],
    useFactory: (
      reports: ReportStore,
      values: DisclosureValueStore,
      taxonomy: TaxonomyRegistry,
      labels: DisclosureLabelResolver,
      vocabulary: WizardVocabulary,
      applicability: ApplicabilityRules,
      axisShapes: AxisShapes,
      derivations: Derivations,
      derivationInputs: DerivationInputStore,
      templateDefaults: TemplateDefaults,
      omissionSections: OmissionSections,
    ) =>
      new ReadWizardStep(
        reports,
        values,
        taxonomy,
        labels,
        vocabulary,
        applicability,
        axisShapes,
        derivations,
        derivationInputs,
        templateDefaults,
        new Logger(ReadWizardStep.name),
        omissionSections,
      ),
  },
  { provide: DERIVATION_INPUT_STORE, useClass: DerivationInputStoreRepository },
  { provide: DERIVATIONS, useClass: DerivationService },
  { provide: TEMPLATE_DEFAULTS, useClass: TemplateDefaultService },
];

const httpProviders: Provider[] = [
  ...evaluationProviders,
  ReportService,
  // FR-41's filed mark (task 47.5): its own port beside the report store, and its two use cases.
  { provide: REPORT_FILING_STORE, useClass: ReportFilingStoreRepository },
  {
    provide: MarkReportFiled,
    inject: [REPORT_STORE, REPORT_FILING_STORE],
    useFactory: (reports: ReportStore, filing: ReportFilingStore) => new MarkReportFiled(reports, filing),
  },
  {
    provide: WithdrawReportFiling,
    inject: [REPORT_STORE, REPORT_FILING_STORE],
    useFactory: (reports: ReportStore, filing: ReportFilingStore) => new WithdrawReportFiling(reports, filing),
  },
  // UC-213's deletion (task 192): the database judges and marks; the use case withdraws the report's notice.
  { provide: REPORT_DELETION_STORE, useClass: ReportDeletionStoreRepository },
  {
    provide: DeleteReport,
    inject: [REPORT_DELETION_STORE, NOTIFICATION_PORT],
    useFactory: (deletion: ReportDeletionStore, notifications: NotificationPort) => new DeleteReport(deletion, notifications),
  },
  // Task 34.2's facade. Takes the store, and takes the *descriptor* from its caller rather than
  // importing one version's — DR-4 makes two coexist, and which applies is a property of the report
  // the caller holds.
  DisclosureFacade,
  { provide: REPORTING_PERIOD_STORE, useClass: ReportingPeriodStoreRepository },
  { provide: CLOCK, useValue: () => new Date() },
  // Task 89's wizard surface. Both use cases are framework-free, so each is a `useFactory` naming
  // its ports — the price of the constraint, and the shape `CreateReport` already sets here.
  WizardService,
  {
    provide: DERIVATION_RECALCULATOR,
    inject: [DERIVATIONS, DISCLOSURE_VALUE_STORE, DERIVATION_INPUT_STORE],
    useFactory: (
      derivations: Derivations,
      values: DisclosureValueStore,
      inputs: DerivationInputStore,
    ) => new DerivationCalculator(derivations, values, inputs),
  },
  {
    provide: WriteDisclosureValues,
    inject: [
      REPORT_STORE,
      DISCLOSURE_VALUE_STORE,
      TAXONOMY_REGISTRY,
      DERIVATIONS,
      DERIVATION_RECALCULATOR,
    ],
    useFactory: (
      reports: ReportStore,
      values: DisclosureValueStore,
      taxonomy: TaxonomyRegistry,
      derivations: Derivations,
      calculator: DerivationRecalculator,
    ) => new WriteDisclosureValues(reports, values, taxonomy, derivations, calculator),
  },
  // Task 38.4: the carbon calculator's figures arrive through this module's own rules, not through its store — a run's
  // write, and UC-34's override, its removal and an explanation, one use case each behind one service.
  {
    provide: WriteCalculatedFigures,
    inject: [DISCLOSURE_VALUE_STORE, DERIVATION_RECALCULATOR],
    useFactory: (values: DisclosureValueStore, recalculator: DerivationRecalculator) =>
      new WriteCalculatedFigures(values, recalculator),
  },
  {
    provide: OverrideCalculatedFigure,
    inject: [DISCLOSURE_VALUE_STORE, DERIVATION_RECALCULATOR],
    useFactory: (values: DisclosureValueStore, recalculator: DerivationRecalculator) =>
      new OverrideCalculatedFigure(values, recalculator),
  },
  {
    provide: RestoreCalculatedFigure,
    inject: [DISCLOSURE_VALUE_STORE, DERIVATION_RECALCULATOR],
    useFactory: (values: DisclosureValueStore, recalculator: DerivationRecalculator) =>
      new RestoreCalculatedFigure(values, recalculator),
  },
  {
    provide: ExplainCalculatedFigure,
    inject: [DISCLOSURE_VALUE_STORE],
    useFactory: (values: DisclosureValueStore) => new ExplainCalculatedFigure(values),
  },
  { provide: CALCULATED_FIGURES, useClass: CalculatedFiguresService },
  {
    provide: WriteDerivationInputs,
    inject: [REPORT_STORE, DERIVATION_INPUT_STORE, DERIVATIONS, DERIVATION_RECALCULATOR],
    useFactory: (
      reports: ReportStore,
      inputs: DerivationInputStore,
      derivations: Derivations,
      calculator: DerivationRecalculator,
    ) => new WriteDerivationInputs(reports, inputs, derivations, calculator),
  },
  {
    provide: CreateReport,
    inject: [REPORT_STORE, REPORTING_PERIOD_STORE, CLOCK],
    useFactory: (reports: ReportStore, periods: ReportingPeriodStore, now: Clock) =>
      new CreateReport(reports, periods, now),
  },
  // Task 51.2's withdrawal: the write that answers the last of what FR-164's notice listed cancels it on its own
  // transaction (182/134), judged against the last run's stored list.
  { provide: LAST_RUN_OUTSTANDING, useClass: LastRunOutstandingRepository },
  {
    provide: ClearOutstandingNotice,
    inject: [LAST_RUN_OUTSTANDING, ReadWizardStep, NOTIFICATION_PORT],
    useFactory: (lastRun: LastRunOutstanding, reads: ReadWizardStep, notifications: NotificationPort) =>
      new ClearOutstandingNotice(lastRun, reads, notifications),
  },
  // Task 50.3's reminder: the first producer to raise through `NOTIFICATION_PORT`, which `NotificationModule`
  // exports on the HTTP side. Its two people are read by this module's own narrow adapter, for the reason
  // `REPORTING_PERIOD_STORE` is registered here — neither identity module exports its store.
  { provide: REMINDER_PARTIES, useClass: ReminderPartiesRepository },
  {
    provide: SendReportReminder,
    inject: [REPORT_STORE, REMINDER_PARTIES, NOTIFICATION_PORT],
    useFactory: (reports: ReportStore, parties: ReminderParties, notifications: NotificationPort) =>
      new SendReportReminder(reports, parties, notifications, randomUUID),
  },
];

@Module({
  // `TaxonomyModule` and `LocalizationModule` imported rather than their providers re-registered:
  // both hold a parsed cache, and a second registration is a second cache (PeriodModule's rule).
  // `OrganizationModule` for its vocabulary port (task 91.1): the wizard names NACE members in the
  // platform's own Romanian and Russian and offers the countries the platform registers.
  // `NotificationModule` for `NOTIFICATION_PORT` (task 50.3), which the reminder raises through.
  // `TraceModule` for `FIELD_CHANGE_COUNTS` (task 84), which the step read's field footers state.
  imports: [TaxonomyModule, LocalizationModule, OrganizationModule, NotificationModule, TraceModule],
  controllers: mode === APP_MODE.WORKER ? [] : [ReportsController, ReportFilingController, WizardController],
  providers: mode === APP_MODE.WORKER ? evaluationProviders : httpProviders,
  // `ReportService` and `WizardService` since task 67.9: a read under a support-access grant runs exactly the
  // reads a member's S-06 and S-07 run, inside the grant's binding, so it borrows them rather than restating.
  // `CALCULATED_FIGURES` since task 38.4, for the carbon calculator's run.
  // `REPORT_STORE` in both since task 44.2: the report's document is composed from it, by the preview and by the
  // export's job on the worker alike.
  exports:
    mode === APP_MODE.WORKER
      ? [ReadWizardStep, REPORT_STORE]
      : [
          DISCLOSURE_VALUE_STORE,
          DisclosureFacade,
          ReportService,
          WizardService,
          CALCULATED_FIGURES,
          ReadWizardStep,
          REPORT_STORE,
        ],
})
export class DisclosureModule {}
