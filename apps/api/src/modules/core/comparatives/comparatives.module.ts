import { Module, type Provider } from '@nestjs/common';
import configuration, { APP_MODE } from '@api/config/configuration';
import { TAXONOMY_REGISTRY, type TaxonomyRegistry } from '@api/contracts/taxonomy-registry.port';
import { PriorPeriodStoreRepository } from '@api/infrastructure/persistence/core/prior-period-store.repository';
import { TaxonomyModule } from '@api/modules/platform/taxonomy/taxonomy.module';
import { ComparativesController } from './controllers/comparatives.controller';
import {
  PRIOR_PERIOD_STORE,
  type PriorPeriodStore,
} from './interfaces/prior-period-store.interface';
import { ComparativesService } from './services/comparatives.service';
import { ReadPriorPeriodValues } from './use-cases/read-prior-period-values.use-case';

/**
 * `core/comparatives` — FR-45 … FR-47
 *
 * Prior-period resolution and carry-forward. **It owns no table**: architecture.md's component
 * table records its storage as "— (reads across periods)", and a comparative is a query over two
 * reports that already exist rather than a third copy of a value.
 *
 * **It does own a route, since task 34.3, and its scaffolded header said otherwise** (§12.5.6). The
 * "—" in that table is the *storage* column; nothing normative denied it a surface. It has to be
 * here rather than in `apps/web`: comparability is computed from two pinned taxonomy versions
 * through `TAXONOMY_REGISTRY`, which the browser has no way to ask.
 *
 * Boundary: `modules/core/**` and `modules/billing/**` may not import each other.
 * Both may import `contracts/**`. Enforced by dependency-cruiser, not by review.
 *
 * **`TaxonomyModule` is imported rather than the registry re-provided**, following `PeriodModule`:
 * the registry holds a parsed cache per configuration revision, and a second registration would be a
 * second cache, silently disagreeing after a publish. That is the distinction `DisclosureModule`
 * draws when it *does* re-provide a store — a repository is a stateless adapter over the request
 * transaction, and a registry is not.
 *
 * **Nothing here is registered on the worker.** No outbox job routes to this module; a comparative
 * is read in a request or not at all.
 */
const { mode } = configuration();

const httpProviders: Provider[] = [
  ComparativesService,
  { provide: PRIOR_PERIOD_STORE, useClass: PriorPeriodStoreRepository },
  {
    provide: ReadPriorPeriodValues,
    inject: [PRIOR_PERIOD_STORE, TAXONOMY_REGISTRY],
    useFactory: (store: PriorPeriodStore, taxonomy: TaxonomyRegistry) =>
      new ReadPriorPeriodValues(store, taxonomy),
  },
];

@Module({
  imports: [TaxonomyModule],
  controllers: mode === APP_MODE.WORKER ? [] : [ComparativesController],
  providers: mode === APP_MODE.WORKER ? [] : httpProviders,
})
export class ComparativesModule {}
