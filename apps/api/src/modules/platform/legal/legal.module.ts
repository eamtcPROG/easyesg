import { Module, type Provider } from '@nestjs/common';
import configuration, { APP_MODE } from '@api/config/configuration';
import { CookieChoiceStoreRepository } from '@api/infrastructure/persistence/platform/cookie-choice-store.repository';
import { CookieChoicePurgeHandler } from './consumers/cookie-choice-purge.handler';
import { CookieChoicesController } from './controllers/cookie-choices.controller';
import { LegalDocumentsController } from './controllers/legal.controller';
import { COOKIE_CHOICE_STORE, type CookieChoiceStore } from './interfaces/cookie-choice-store.interface';
import { CookieChoiceService } from './services/cookie-choice.service';
import { LegalControllerService } from './services/legal-controller.service';
import { PurgeCookieChoices } from './use-cases/purge-cookie-choices.use-case';
import { RecordCookieChoice } from './use-cases/record-cookie-choice.use-case';

/**
 * `platform/legal` — FR-205's controller, the operator the legal documents name (task 75; `architecture.md` §17.5,
 * §12.5.6's task-75 row (7), (8)). It owns the `legal_controller` artefact's kind, its reader and its publication
 * rule; A-21's routes, which publish it, are `platform/admin`'s, as A-18's are. The documents' text is `apps/web`'s,
 * committed to the release (182/116).
 *
 * **And since task 223 the cookie banner's answers** (FR-206; §12.5.6's task-223 row): recorded on the request tier, and
 * purged nightly on the worker — the module's first worker half. Nothing on the worker reads the controller, and
 * nothing on the request tier deletes an answer.
 */
const { mode } = configuration();

const store: Provider = { provide: COOKIE_CHOICE_STORE, useClass: CookieChoiceStoreRepository };

const httpProviders: Provider[] = [
  LegalControllerService,
  CookieChoiceService,
  store,
  {
    provide: RecordCookieChoice,
    inject: [COOKIE_CHOICE_STORE],
    useFactory: (choices: CookieChoiceStore) => new RecordCookieChoice(choices),
  },
];

const workerProviders: Provider[] = [
  CookieChoicePurgeHandler,
  store,
  {
    provide: PurgeCookieChoices,
    inject: [COOKIE_CHOICE_STORE],
    useFactory: (choices: CookieChoiceStore) => new PurgeCookieChoices(choices),
  },
];

@Module({
  controllers: mode === APP_MODE.WORKER ? [] : [LegalDocumentsController, CookieChoicesController],
  providers: mode === APP_MODE.WORKER ? workerProviders : httpProviders,
})
export class LegalModule {}
