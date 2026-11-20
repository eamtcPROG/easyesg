import { Module, type Provider } from '@nestjs/common';
import { CLOCK, type Clock } from '@api/contracts/clock.port';
import { AdminReadOnly } from '@api/infrastructure/persistence/admin-readonly';
import { ContentConsoleStoreRepository } from '@api/infrastructure/persistence/platform/content-console-store.repository';
import {
  CONTENT_CONSOLE_STORE,
  type ContentConsoleStore,
} from './interfaces/content-console-store.interface';
import { ContentConsoleService } from './services/content-console.service';
import { DiscardContentDraft } from './use-cases/discard-content-draft.use-case';
import { ListContentConsole } from './use-cases/list-content-console.use-case';
import { PreviewContentPublication } from './use-cases/preview-content-publication.use-case';
import { PublishContentSet } from './use-cases/publish-content-set.use-case';
import { PublishLocaleRegistration } from './use-cases/publish-locale-registration.use-case';
import { RevertContentItem } from './use-cases/revert-content-item.use-case';
import { SaveContentDraft } from './use-cases/save-content-draft.use-case';
import { SubmitContentDraft } from './use-cases/submit-content-draft.use-case';
import configuration, { APP_MODE } from '@api/config/configuration';
import { LocalizationModule } from '../localization/localization.module';
import { ContentController } from './controllers/content.controller';
import { ContentTranslationWatch } from './services/content-translation-watch.service';
import { ContentService } from './services/content.service';
import { PublishedContentReader } from './services/published-content-reader.service';

/**
 * `platform/content` — FR-61's read side and FR-64's runtime fallback, UC-180, UC-181 (task 76; OQ-44;
 * `architecture.md` §6.7, §17.5, §12.5.6's task-76 row).
 *
 * **A module of its own** (OQ-44, 24 Aug 2026): not `platform/configuration`, which owns the store's mechanism and
 * knows nothing of any artefact's meaning, and not `platform/localization`, which resolves committed catalogues — help
 * content is store rows published without a release, read by a caller with no session. Publishing is the store's;
 * A-03's editor is `platform/admin`'s (67.5). FR-64's queue is `platform/localization`'s (§6.6): this module reports into
 * it and tells it what is translated. Each kind's publication rule is its reader's (`configuration-kind-rules.ts`).
 *
 * **Request tier only.** Nothing on the worker reads FR-61 content.
 */
const { mode } = configuration();

/**
 * A-03's editor (task 67.5; §12.5.6's task-67.5 row) — the use cases over `CONTENT_CONSOLE_STORE`, and the service the
 * admin realm's controller calls, which is why it is exported. `AdminReadOnly` is provided here for the preview's
 * organization count; it is the same door A-02 reads through, stateless, every acquisition logged.
 */
const store = (factory: (store: ContentConsoleStore) => unknown) => ({ inject: [CONTENT_CONSOLE_STORE], useFactory: factory });
const consoleProviders: Provider[] = [
  AdminReadOnly,
  { provide: CONTENT_CONSOLE_STORE, useClass: ContentConsoleStoreRepository },
  { provide: CLOCK, useValue: (() => new Date()) as Clock },
  { provide: ListContentConsole, ...store((s) => new ListContentConsole(s)) },
  { provide: SaveContentDraft, ...store((s) => new SaveContentDraft(s)) },
  { provide: SubmitContentDraft, ...store((s) => new SubmitContentDraft(s)) },
  { provide: DiscardContentDraft, ...store((s) => new DiscardContentDraft(s)) },
  { provide: PreviewContentPublication, ...store((s) => new PreviewContentPublication(s)) },
  {
    provide: PublishContentSet,
    inject: [CONTENT_CONSOLE_STORE, CLOCK],
    useFactory: (s: ContentConsoleStore, now: Clock) => new PublishContentSet(s, now),
  },
  { provide: RevertContentItem, ...store((s) => new RevertContentItem(s)) },
  { provide: PublishLocaleRegistration, ...store((s) => new PublishLocaleRegistration(s)) },
  ContentConsoleService,
];

@Module({
  imports: [LocalizationModule],
  controllers: mode === APP_MODE.WORKER ? [] : [ContentController],
  providers:
    mode === APP_MODE.WORKER ? [] : [PublishedContentReader, ContentService, ContentTranslationWatch, ...consoleProviders],
  exports: mode === APP_MODE.WORKER ? [] : [ContentConsoleService],
})
export class ContentModule {}
