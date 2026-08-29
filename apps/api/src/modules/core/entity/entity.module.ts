import { Module, type Provider } from '@nestjs/common';
import configuration, { APP_MODE } from '@api/config/configuration';
import { CLOCK, type Clock } from '@api/contracts/clock.port';
import { ReportingEntityStoreRepository } from '@api/infrastructure/persistence/core/reporting-entity-store.repository';
import { OrganizationStoreRepository } from '@api/infrastructure/persistence/core/organization-store.repository';
import {
  ORGANIZATION_STORE,
  type OrganizationStore,
} from '@api/modules/core/organization/interfaces/organization-store.interface';
import {
  ORGANIZATION_VOCABULARY,
  type OrganizationVocabulary,
} from '@api/modules/core/organization/interfaces/organization-vocabulary.interface';
import { OrganizationVocabularyService } from '@api/modules/core/organization/services/organization-vocabulary.service';
import { EntitiesController } from './controllers/entities.controller';
import {
  REPORTING_ENTITY_STORE,
  type ReportingEntityStore,
} from './interfaces/reporting-entity-store.interface';
import { EntityService } from './services/entity.service';
import { ManageReportingEntity } from './use-cases/manage-reporting-entity.use-case';
import { NaceCodeLookup } from './use-cases/search-nace-codes.use-case';

/**
 * `core/entity` — FR-17 … FR-20
 *
 * Reporting entities, sites, consolidation scope, point-in-time master-data snapshots.
 *
 * Boundary: `modules/core/**` and `modules/billing/**` may not import each other.
 * Both may import `contracts/**`. Enforced by dependency-cruiser, not by review.
 *
 * Wired as its siblings are: use cases carry no `@Injectable()` — `domain-free-of-frameworks`
 * forbids a NestJS import in `use-cases/` — so they are constructed by `useFactory` naming their
 * tokens. One clock for the module (P-7).
 *
 * **It provides the organization's store and vocabulary rather than importing `OrganizationModule`,
 * and that is deliberate.** An activity code is admitted against the classifier registered for the
 * organization's country, so this module needs to read the bound organization — but importing the
 * other module would also pull in its controllers and its founding store, giving this one a
 * dependency on routes it never calls. Both providers are stateless adapters over the same request
 * transaction, so a second registration is a second reference to the same behaviour, not a second
 * source of truth.
 *
 * **Nothing here is registered on the worker.** No outbox job routes to this module: creating,
 * editing and archiving an entity are synchronous and emit no notification of their own.
 */
const { mode } = configuration();

const httpProviders: Provider[] = [
  EntityService,
  { provide: REPORTING_ENTITY_STORE, useClass: ReportingEntityStoreRepository },
  { provide: ORGANIZATION_STORE, useClass: OrganizationStoreRepository },
  { provide: ORGANIZATION_VOCABULARY, useClass: OrganizationVocabularyService },
  { provide: CLOCK, useValue: () => new Date() },
  {
    provide: NaceCodeLookup,
    inject: [ORGANIZATION_STORE, ORGANIZATION_VOCABULARY],
    useFactory: (organizations: OrganizationStore, vocabulary: OrganizationVocabulary) =>
      new NaceCodeLookup(organizations, vocabulary),
  },
  {
    provide: ManageReportingEntity,
    inject: [REPORTING_ENTITY_STORE, ORGANIZATION_STORE, ORGANIZATION_VOCABULARY, CLOCK],
    useFactory: (
      store: ReportingEntityStore,
      organizations: OrganizationStore,
      vocabulary: OrganizationVocabulary,
      now: Clock,
    ) => new ManageReportingEntity(store, organizations, vocabulary, now),
  },
];

@Module({
  controllers: mode === APP_MODE.WORKER ? [] : [EntitiesController],
  providers: mode === APP_MODE.WORKER ? [] : httpProviders,
})
export class EntityModule {}
