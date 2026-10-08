import { Module, type Provider } from '@nestjs/common';
import configuration, { APP_MODE } from '@api/config/configuration';
import { CLOCK, type Clock } from '@api/contracts/clock.port';
import { ValidationReportsRepository } from '@api/infrastructure/persistence/core/validation-reports.repository';
import { ValidationStoreRepository } from '@api/infrastructure/persistence/core/validation-store.repository';
import { ComparativesModule } from '@api/modules/core/comparatives/comparatives.module';
import { ReadPriorPeriodValues } from '@api/modules/core/comparatives/use-cases/read-prior-period-values.use-case';
import { DisclosureModule } from '@api/modules/core/disclosure/disclosure.module';
import { WizardService } from '@api/modules/core/disclosure/services/wizard.service';
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
 *   use case knows neither module. An export request (47.4) and a notice's schedule (51.2) will evaluate on the worker;
 *   until they do, nothing here runs there but the rule-set read.
 *
 * Boundary: `modules/core/**` and `modules/billing/**` may not import each other.
 * Both may import `contracts/**`. Enforced by dependency-cruiser, not by review.
 */
const { mode } = configuration();

const httpProviders: Provider[] = [
  ValidationService,
  { provide: CLOCK, useValue: () => new Date() },
  { provide: VALIDATION_STORE, useClass: ValidationStoreRepository },
  { provide: VALIDATION_REPORTS, useClass: ValidationReportsRepository },
  // `WizardService` answers the port's one method as it stands: the scope is disclosure's, computed once.
  { provide: EVALUATION_SCOPES, useExisting: WizardService },
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

@Module({
  imports: [DisclosureModule, ComparativesModule],
  controllers: mode === APP_MODE.WORKER ? [] : [ValidationController],
  providers: [
    { provide: VALIDATION_RULE_SETS, useClass: ValidationRuleSetCatalog },
    ...(mode === APP_MODE.WORKER ? [] : httpProviders),
  ],
  exports: [VALIDATION_RULE_SETS],
})
export class ValidationModule {}
