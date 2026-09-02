import { Module, type Provider } from '@nestjs/common';
import configuration, { APP_MODE } from '@api/config/configuration';
import { CLOCK, type Clock } from '@api/contracts/clock.port';
import { OrganizationFoundingStoreRepository } from '@api/infrastructure/persistence/core/organization-founding-store.repository';
import { OrganizationStoreRepository } from '@api/infrastructure/persistence/core/organization-store.repository';
import { OrganizationController } from './controllers/organization.controller';
import { OrganizationsController } from './controllers/organizations.controller';
import {
  ORGANIZATION_FOUNDING_STORE,
  type OrganizationFoundingStore,
} from './interfaces/organization-founding-store.interface';
import { ORGANIZATION_STORE, type OrganizationStore } from './interfaces/organization-store.interface';
import {
  ORGANIZATION_VOCABULARY,
  type OrganizationVocabulary,
} from './interfaces/organization-vocabulary.interface';
import { OrganizationService } from './services/organization.service';
import { OrganizationVocabularyService } from './services/organization-vocabulary.service';
import { CreateOrganization } from './use-cases/create-organization.use-case';
import { ListLegalForms } from './use-cases/list-legal-forms.use-case';
import { UpdateOrganizationProfile } from './use-cases/update-organization-profile.use-case';
import { ViewOrganization } from './use-cases/view-organization.use-case';

/**
 * `core/organization` — FR-13, FR-14, FR-15
 *
 * Organization aggregate and typed org relationships. Lives in `core`, not a tenancy schema;
 * `billing` references it by id with no FK (NFR-15).
 *
 * Boundary: `modules/core/**` and `modules/billing/**` may not import each other.
 * Both may import `contracts/**`. Enforced by dependency-cruiser, not by review.
 *
 * Wired as `MembershipModule` is: use cases carry no `@Injectable()` — `domain-free-of-frameworks`
 * forbids a NestJS import in `use-cases/` — so they have no constructor metadata for Nest to read
 * and are constructed by `useFactory` naming their tokens. One clock for the module (P-7).
 *
 * **Two stores, because the two writes happen at different moments in a request's life.**
 * `ORGANIZATION_STORE` runs on the request's transaction, where a tenant is bound;
 * `ORGANIZATION_FOUNDING_STORE` opens its own, because the organization it creates has no id to
 * have been bound and the caller's bound organization would be the wrong one. Each port's header
 * says which it is, and registering both here is what keeps a caller from reaching for whichever it
 * can see.
 *
 * **Nothing here is registered on the worker.** The outbox routes no job to this module: creating
 * or editing an organization is synchronous and emits no notification of its own.
 */
const { mode } = configuration();

const httpProviders: Provider[] = [
  OrganizationService,
  { provide: ORGANIZATION_STORE, useClass: OrganizationStoreRepository },
  { provide: ORGANIZATION_FOUNDING_STORE, useClass: OrganizationFoundingStoreRepository },
  { provide: ORGANIZATION_VOCABULARY, useClass: OrganizationVocabularyService },
  { provide: CLOCK, useValue: () => new Date() },
  {
    provide: CreateOrganization,
    inject: [ORGANIZATION_FOUNDING_STORE, ORGANIZATION_VOCABULARY],
    useFactory: (store: OrganizationFoundingStore, vocabulary: OrganizationVocabulary) =>
      new CreateOrganization(store, vocabulary),
  },
  {
    provide: ViewOrganization,
    inject: [ORGANIZATION_STORE],
    useFactory: (store: OrganizationStore) => new ViewOrganization(store),
  },
  {
    provide: UpdateOrganizationProfile,
    inject: [ORGANIZATION_STORE, ORGANIZATION_VOCABULARY, CLOCK],
    useFactory: (store: OrganizationStore, vocabulary: OrganizationVocabulary, now: Clock) =>
      new UpdateOrganizationProfile(store, vocabulary, now),
  },
  {
    provide: ListLegalForms,
    inject: [ORGANIZATION_VOCABULARY],
    useFactory: (vocabulary: OrganizationVocabulary) => new ListLegalForms(vocabulary),
  },
];

@Module({
  controllers: mode === APP_MODE.WORKER ? [] : [OrganizationsController, OrganizationController],
  providers: mode === APP_MODE.WORKER ? [] : httpProviders,
  // The vocabulary port, for the wizard (task 91.1): NACE members named in the platform's own
  // Romanian and Russian, and the countries the platform registers as ISO 3166's members.
  exports: mode === APP_MODE.WORKER ? [] : [ORGANIZATION_VOCABULARY],
})
export class OrganizationModule {}
