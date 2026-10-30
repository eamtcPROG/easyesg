import { Module } from '@nestjs/common';
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

@Module({
  imports: [LocalizationModule],
  controllers: mode === APP_MODE.WORKER ? [] : [ContentController],
  providers: mode === APP_MODE.WORKER ? [] : [PublishedContentReader, ContentService, ContentTranslationWatch],
})
export class ContentModule {}
