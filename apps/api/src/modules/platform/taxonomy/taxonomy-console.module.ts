import { Module, type Provider } from '@nestjs/common';
import configuration, { APP_MODE } from '@api/config/configuration';
import { CLOCK, type Clock } from '@api/contracts/clock.port';
import { DISCLOSURE_LABELS, type DisclosureLabelResolver } from '@api/contracts/disclosure-label.port';
import { TAXONOMY_REGISTRY, type TaxonomyRegistry } from '@api/contracts/taxonomy-registry.port';
import { AdminReadOnly } from '@api/infrastructure/persistence/admin-readonly';
import { TaxonomyConsoleStoreRepository } from '@api/infrastructure/persistence/platform/taxonomy-console-store.repository';
import { LocalizationModule } from '../localization/localization.module';
import {
  TAXONOMY_CONSOLE_STORE,
  type TaxonomyConsoleStore,
} from './interfaces/taxonomy-console-store.interface';
import { TaxonomyConsoleService } from './services/taxonomy-console.service';
import { TaxonomyModule } from './taxonomy.module';
import { AdoptTaxonomyVersion } from './use-cases/adopt-taxonomy-version.use-case';
import { ProposeVersionMapping } from './use-cases/propose-version-mapping.use-case';
import { PublishVersionMapping } from './use-cases/publish-version-mapping.use-case';
import { ReadLabelDiff } from './use-cases/read-label-diff.use-case';
import { ReadTaxonomyConsole } from './use-cases/read-taxonomy-console.use-case';
import { ReadTaxonomyExposure } from './use-cases/read-taxonomy-exposure.use-case';
import { RegisterTaxonomyVersion } from './use-cases/register-taxonomy-version.use-case';

/**
 * A-04's application half (tasks 67.21, 67.22, 67.6; §12.5.6's task-67.21 row) — a module of its own beside
 * `TaxonomyModule`, because it reads the disclosure labels (`LocalizationModule`) for the EFRAG label diff and the
 * registry is what that module labels: one module holding both would make each the other's dependency. **Request tier
 * only**; a migration run's worker job (67.24) is `TaxonomyMigrationModule`'s. Its service is exported for the admin
 * realm's controller, and its store for the run's start, which checks the pair against the versions registered (67.23).
 */
const { mode } = configuration();

const providers: Provider[] = [
  AdminReadOnly,
  { provide: CLOCK, useValue: (() => new Date()) as Clock },
  { provide: TAXONOMY_CONSOLE_STORE, useClass: TaxonomyConsoleStoreRepository },
  {
    provide: ReadTaxonomyConsole,
    inject: [TAXONOMY_CONSOLE_STORE],
    useFactory: (store: TaxonomyConsoleStore) => new ReadTaxonomyConsole(store),
  },
  {
    provide: RegisterTaxonomyVersion,
    inject: [TAXONOMY_CONSOLE_STORE],
    useFactory: (store: TaxonomyConsoleStore) => new RegisterTaxonomyVersion(store),
  },
  {
    provide: ProposeVersionMapping,
    inject: [TAXONOMY_REGISTRY],
    useFactory: (registry: TaxonomyRegistry) => new ProposeVersionMapping(registry),
  },
  {
    provide: PublishVersionMapping,
    inject: [TAXONOMY_REGISTRY, TAXONOMY_CONSOLE_STORE],
    useFactory: (registry: TaxonomyRegistry, store: TaxonomyConsoleStore) => new PublishVersionMapping(registry, store),
  },
  {
    provide: AdoptTaxonomyVersion,
    inject: [TAXONOMY_CONSOLE_STORE, CLOCK],
    useFactory: (store: TaxonomyConsoleStore, now: Clock) => new AdoptTaxonomyVersion(store, now),
  },
  {
    provide: ReadTaxonomyExposure,
    inject: [TAXONOMY_REGISTRY, TAXONOMY_CONSOLE_STORE],
    useFactory: (registry: TaxonomyRegistry, store: TaxonomyConsoleStore) => new ReadTaxonomyExposure(registry, store),
  },
  {
    provide: ReadLabelDiff,
    inject: [DISCLOSURE_LABELS],
    useFactory: (labels: DisclosureLabelResolver) => new ReadLabelDiff(labels),
  },
  TaxonomyConsoleService,
];

@Module({
  imports: [TaxonomyModule, LocalizationModule],
  providers: mode === APP_MODE.WORKER ? [] : providers,
  exports: mode === APP_MODE.WORKER ? [] : [TaxonomyConsoleService, TAXONOMY_CONSOLE_STORE],
})
export class TaxonomyConsoleModule {}
