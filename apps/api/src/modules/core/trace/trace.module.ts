import { Module } from '@nestjs/common';
import { FIELD_CHANGE_COUNTS } from '@api/contracts/field-change-counts.port';
import { TAXONOMY_REGISTRY, type TaxonomyRegistry } from '@api/contracts/taxonomy-registry.port';
import { ChangeTrailRepository } from '@api/infrastructure/persistence/core/change-trail.repository';
import { OrganizationStoreRepository } from '@api/infrastructure/persistence/core/organization-store.repository';
import { NaceCodeLookup } from '@api/modules/core/entity/use-cases/search-nace-codes.use-case';
import {
  ORGANIZATION_STORE,
  type OrganizationStore,
} from '@api/modules/core/organization/interfaces/organization-store.interface';
import {
  ORGANIZATION_VOCABULARY,
  type OrganizationVocabulary,
} from '@api/modules/core/organization/interfaces/organization-vocabulary.interface';
import { OrganizationModule } from '@api/modules/core/organization/organization.module';
import { LocalizationModule } from '@api/modules/platform/localization/localization.module';
import { TaxonomyModule } from '@api/modules/platform/taxonomy/taxonomy.module';
import { ChangeHistoryController } from './controllers/change-history.controller';
import { CHANGE_TRAIL_STORE, type ChangeTrailStore } from './interfaces/change-trail.interface';
import { ChangeWordsFactory } from './providers/change-words.factory';
import { TraceService } from './services/trace.service';
import { CountFieldChanges } from './use-cases/count-field-changes.use-case';
import { ReadChangeHistory } from './use-cases/read-change-history.use-case';

/**
 * `core/trace` — FR-54, FR-55
 *
 * Per-field change history, read from `core.field_change`, which task 14's capture trigger writes (task 84;
 * `architecture.md` §12.5.6's task-84 row): UC-47's three reads, and the count S-07's field footer states, which
 * `core/disclosure`'s step read reaches through `FIELD_CHANGE_COUNTS` — this module reads the disclosure's vocabulary, so
 * an import back would close a cycle. Attribution survives membership removal: the trail's actor carries no foreign key,
 * and the read marks a person removed rather than dropping them (FR-55).
 *
 * **The activity lookup is built here as `EntityModule` builds it** — that module exports nothing, and its use case is
 * framework-free, so the two instances read the same classifier through the same store and vocabulary.
 *
 * Boundary: `modules/core/**` and `modules/billing/**` may not import each other.
 * Both may import `contracts/**`. Enforced by dependency-cruiser, not by review.
 */
@Module({
  imports: [OrganizationModule, LocalizationModule, TaxonomyModule],
  controllers: [ChangeHistoryController],
  providers: [
    { provide: CHANGE_TRAIL_STORE, useClass: ChangeTrailRepository },
    { provide: ORGANIZATION_STORE, useClass: OrganizationStoreRepository },
    {
      provide: NaceCodeLookup,
      inject: [ORGANIZATION_STORE, ORGANIZATION_VOCABULARY],
      useFactory: (organizations: OrganizationStore, vocabulary: OrganizationVocabulary) =>
        new NaceCodeLookup(organizations, vocabulary),
    },
    {
      provide: ReadChangeHistory,
      inject: [CHANGE_TRAIL_STORE, TAXONOMY_REGISTRY],
      useFactory: (trail: ChangeTrailStore, taxonomy: TaxonomyRegistry) => new ReadChangeHistory(trail, taxonomy),
    },
    {
      provide: CountFieldChanges,
      inject: [CHANGE_TRAIL_STORE],
      useFactory: (trail: ChangeTrailStore) => new CountFieldChanges(trail),
    },
    { provide: FIELD_CHANGE_COUNTS, useExisting: CountFieldChanges },
    ChangeWordsFactory,
    TraceService,
  ],
  exports: [FIELD_CHANGE_COUNTS],
})
export class TraceModule {}
