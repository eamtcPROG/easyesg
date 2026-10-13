import { Module } from '@nestjs/common';
import configuration, { APP_MODE } from '@api/config/configuration';
import { LegalDocumentsController } from './controllers/legal.controller';
import { LegalControllerService } from './services/legal-controller.service';

/**
 * `platform/legal` — FR-205's controller, the operator the legal documents name (task 75; `architecture.md` §17.5,
 * §12.5.6's task-75 row (7), (8)). It owns the `legal_controller` artefact's kind, its reader and its publication
 * rule; A-21's routes, which publish it, are `platform/admin`'s, as A-18's are. The documents' text is `apps/web`'s,
 * committed to the release (182/116).
 *
 * HTTP only: nothing on the worker reads the controller.
 */
const { mode } = configuration();

@Module({
  controllers: mode === APP_MODE.WORKER ? [] : [LegalDocumentsController],
  providers: mode === APP_MODE.WORKER ? [] : [LegalControllerService],
})
export class LegalModule {}
