import { Module, type Provider } from '@nestjs/common';
import configuration, { APP_MODE } from '@api/config/configuration';
import { AccessStoreRepository } from '@api/infrastructure/persistence/identity/access-store.repository';
import { AccessController } from './controllers/access.controller';
import { ACCESS_STORE, type AccessStore } from './interfaces/access-store.interface';
import { AccessService } from './services/access.service';
import { ListAccess } from './use-cases/list-access.use-case';

/**
 * `identity/access` — FR-56, UC-59 (task 131).
 *
 * **A module of its own rather than a second controller on `membership`.** Its subject is the
 * *union* of two collections, which is neither module's aggregate: putting it in `membership` would
 * make that module read `identity.invitation`, and putting it in `invitation` the reverse. Both are
 * the cross-aggregate reach `modules/*` boundaries exist to prevent. A read model spanning two
 * aggregates is its own responsibility (S in SOLID, as §5.2 draws it).
 *
 * It owns **no writes and no tables**. Every action a row offers belongs to the collection it came
 * from, and this module's store issues `SELECT` and nothing else.
 *
 * Wired as its siblings are: the use case carries no `@Injectable()` — `domain-free-of-frameworks`
 * forbids a NestJS import in `use-cases/` — so it has no constructor metadata for Nest to read and
 * is constructed by `useFactory` naming its token.
 *
 * **Nothing here is registered on the worker.** The outbox routes no job to a read model.
 */
const { mode } = configuration();

const httpProviders: Provider[] = [
  AccessService,
  { provide: ACCESS_STORE, useClass: AccessStoreRepository },
  {
    provide: ListAccess,
    inject: [ACCESS_STORE],
    useFactory: (store: AccessStore) => new ListAccess(store),
  },
];

@Module({
  controllers: mode === APP_MODE.WORKER ? [] : [AccessController],
  providers: mode === APP_MODE.WORKER ? [] : httpProviders,
})
export class AccessModule {}
