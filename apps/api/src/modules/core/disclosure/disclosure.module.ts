import { Logger, Module, type Provider } from '@nestjs/common';
import configuration, { APP_MODE } from '@api/config/configuration';
import { CLOCK, type Clock } from '@api/contracts/clock.port';
import { DisclosureValueStoreRepository } from '@api/infrastructure/persistence/core/disclosure-value-store.repository';
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
import { TaxonomyModule } from '@api/modules/platform/taxonomy/taxonomy.module';
import { ReportsController } from './controllers/reports.controller';
import { WizardController } from './controllers/wizard.controller';
import {
  DISCLOSURE_VALUE_STORE,
  type DisclosureValueStore,
} from './interfaces/disclosure-value-store.interface';
import { REPORT_STORE, type ReportStore } from './interfaces/report-store.interface';
import { DisclosureFacade } from './services/disclosure-facade.service';
import { ReportService } from './services/report.service';
import { WizardService } from './services/wizard.service';
import { CreateReport } from './use-cases/create-report.use-case';
import { ReadWizardStep, type WizardVocabulary } from './use-cases/read-wizard-step.use-case';
import { WriteDisclosureValues } from './use-cases/write-disclosure-values.use-case';

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
 * **Nothing here is registered on the worker.** No outbox job routes to this module; creating a
 * report is synchronous and emits no notification of its own.
 */
const { mode } = configuration();

const httpProviders: Provider[] = [
  ReportService,
  { provide: REPORT_STORE, useClass: ReportStoreRepository },
  // Task 34.1's store. Provided and exported with no use case above it yet: the wizard that writes
  // through it is task 36 and the typed facade is 34.2, so what exists here is the adapter and the
  // guarantees under it. Registering it now is what makes those guarantees testable against the real
  // schema rather than described — `disclosure-value.e2e-spec.ts` is the proof.
  { provide: DISCLOSURE_VALUE_STORE, useClass: DisclosureValueStoreRepository },
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
    provide: ReadWizardStep,
    inject: [REPORT_STORE, DISCLOSURE_VALUE_STORE, TAXONOMY_REGISTRY, DISCLOSURE_LABELS, ORGANIZATION_VOCABULARY],
    useFactory: (
      reports: ReportStore,
      values: DisclosureValueStore,
      taxonomy: TaxonomyRegistry,
      labels: DisclosureLabelResolver,
      vocabulary: WizardVocabulary,
    ) => new ReadWizardStep(reports, values, taxonomy, labels, vocabulary, new Logger(ReadWizardStep.name)),
  },
  {
    provide: WriteDisclosureValues,
    inject: [REPORT_STORE, DISCLOSURE_VALUE_STORE, TAXONOMY_REGISTRY],
    useFactory: (reports: ReportStore, values: DisclosureValueStore, taxonomy: TaxonomyRegistry) =>
      new WriteDisclosureValues(reports, values, taxonomy),
  },
  {
    provide: CreateReport,
    inject: [REPORT_STORE, REPORTING_PERIOD_STORE, CLOCK],
    useFactory: (reports: ReportStore, periods: ReportingPeriodStore, now: Clock) =>
      new CreateReport(reports, periods, now),
  },
];

@Module({
  // `TaxonomyModule` and `LocalizationModule` imported rather than their providers re-registered:
  // both hold a parsed cache, and a second registration is a second cache (PeriodModule's rule).
  // `OrganizationModule` for its vocabulary port (task 91.1): the wizard names NACE members in the
  // platform's own Romanian and Russian and offers the countries the platform registers.
  imports: [TaxonomyModule, LocalizationModule, OrganizationModule],
  controllers: mode === APP_MODE.WORKER ? [] : [ReportsController, WizardController],
  providers: mode === APP_MODE.WORKER ? [] : httpProviders,
  exports: mode === APP_MODE.WORKER ? [] : [DISCLOSURE_VALUE_STORE, DisclosureFacade],
})
export class DisclosureModule {}
