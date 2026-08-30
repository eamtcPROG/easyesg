import { Module, type Provider } from '@nestjs/common';
import configuration, { APP_MODE } from '@api/config/configuration';
import { CLOCK, type Clock } from '@api/contracts/clock.port';
import { TAXONOMY_REGISTRY, type TaxonomyRegistry } from '@api/contracts/taxonomy-registry.port';
import { ReportingEntityStoreRepository } from '@api/infrastructure/persistence/core/reporting-entity-store.repository';
import { ReportingPeriodStoreRepository } from '@api/infrastructure/persistence/core/reporting-period-store.repository';
import {
  REPORTING_ENTITY_STORE,
  type ReportingEntityStore,
} from '@api/modules/core/entity/interfaces/reporting-entity-store.interface';
import { TaxonomyModule } from '@api/modules/platform/taxonomy/taxonomy.module';
import { PeriodsController } from './controllers/periods.controller';
import {
  REPORTING_PERIOD_STORE,
  type ReportingPeriodStore,
} from './interfaces/reporting-period-store.interface';
import { PeriodService } from './services/period.service';
import { LockReportingPeriod } from './use-cases/lock-reporting-period.use-case';
import { OpenReportingPeriod } from './use-cases/open-reporting-period.use-case';

/**
 * `core/period` — FR-21, FR-22, FR-45
 *
 * Reporting periods, their lock and reopen, prior-period linkage, and the template and taxonomy
 * version pinned at period open.
 *
 * Boundary: `modules/core/**` and `modules/billing/**` may not import each other.
 * Both may import `contracts/**`. Enforced by dependency-cruiser, not by review.
 *
 * **It imports `TaxonomyModule` rather than re-providing the registry**, which is the opposite of
 * what `EntityModule` does with the organization's store — and the difference is deliberate. That
 * module re-registers two *stateless adapters over the request transaction*, so a second
 * registration is a second reference to the same behaviour. The taxonomy registry holds a cache
 * keyed on the configuration revision, so a second instance would be a second cache warming
 * separately over 143 elements and 973 waste members.
 *
 * **It provides `REPORTING_ENTITY_STORE` itself**, following `EntityModule`'s pattern for the same
 * stated reason: opening a period reads the entity to refuse an archived one (FR-20), and importing
 * `EntityModule` would pull in its controllers and give this module a dependency on routes it never
 * calls.
 *
 * **Nothing here is registered on the worker.** No outbox job routes to this module; opening and
 * editing a period are synchronous and emit no notification of their own. UC-170's deadline notice
 * counts down to `due_date` and is task 50's, on its own schedule.
 */
const { mode } = configuration();

const httpProviders: Provider[] = [
  PeriodService,
  { provide: REPORTING_PERIOD_STORE, useClass: ReportingPeriodStoreRepository },
  { provide: REPORTING_ENTITY_STORE, useClass: ReportingEntityStoreRepository },
  { provide: CLOCK, useValue: () => new Date() },
  {
    provide: LockReportingPeriod,
    inject: [REPORTING_PERIOD_STORE, CLOCK],
    useFactory: (store: ReportingPeriodStore, now: Clock) => new LockReportingPeriod(store, now),
  },
  {
    provide: OpenReportingPeriod,
    inject: [REPORTING_PERIOD_STORE, REPORTING_ENTITY_STORE, TAXONOMY_REGISTRY, CLOCK],
    useFactory: (
      store: ReportingPeriodStore,
      entities: ReportingEntityStore,
      taxonomy: TaxonomyRegistry,
      now: Clock,
    ) => new OpenReportingPeriod(store, entities, taxonomy, now),
  },
];

@Module({
  imports: [TaxonomyModule],
  controllers: mode === APP_MODE.WORKER ? [] : [PeriodsController],
  providers: mode === APP_MODE.WORKER ? [] : httpProviders,
})
export class PeriodModule {}
