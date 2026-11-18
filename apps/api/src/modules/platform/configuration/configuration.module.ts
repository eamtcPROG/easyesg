import { Module, type Provider } from '@nestjs/common';
import configuration, { APP_MODE } from '@api/config/configuration';
import { RulesConsoleStoreRepository } from '@api/infrastructure/persistence/platform/rules-console-store.repository';
import { RULES_CONSOLE_STORE, type RulesConsoleStore } from './interfaces/rules-console-store.interface';
import { RulesConsoleService } from './services/rules-console.service';
import { PublishRules } from './use-cases/publish-rules.use-case';
import { ReadRulesConsole } from './use-cases/read-rules-console.use-case';

/**
 * `platform/configuration` — FR-61, FR-62, FR-71 … FR-74: the configuration store's lifecycle (AD-4) — draft, in
 * review, published, superseded, revert in one step — and the rule layer held in it. The store itself is
 * `infrastructure/configuration`'s, global; **this module is A-05's application half since task 67.8** — the factor
 * sets, the applicability thresholds and the validation rule set read and published from the console. Request tier only,
 * its service exported for the admin realm's controller, A-17's arrangement. What a publication sets off — a replaced
 * factor set's notice (37.3), a threshold change's (67.8) — is the store's and the worker's, not this module's.
 *
 * Boundary: `modules/core/**` and `modules/billing/**` may not import each other. Both may import `contracts/**`.
 * Enforced by dependency-cruiser, not by review.
 */
const { mode } = configuration();

const providers: Provider[] = [
  { provide: RULES_CONSOLE_STORE, useClass: RulesConsoleStoreRepository },
  { provide: ReadRulesConsole, inject: [RULES_CONSOLE_STORE], useFactory: (store: RulesConsoleStore) => new ReadRulesConsole(store) },
  { provide: PublishRules, inject: [RULES_CONSOLE_STORE], useFactory: (store: RulesConsoleStore) => new PublishRules(store) },
  RulesConsoleService,
];

@Module({
  providers: mode === APP_MODE.WORKER ? [] : providers,
  exports: mode === APP_MODE.WORKER ? [] : [RulesConsoleService],
})
export class ConfigurationModule {}
