import { Module, type Provider } from '@nestjs/common';
import configuration, { APP_MODE } from '@api/config/configuration';
import { SEAT_ALLOWANCE, type SeatAllowance } from '@api/contracts/seat-allowance.port';
import { AccessStoreRepository } from '@api/infrastructure/persistence/identity/access-store.repository';
import { AccessController } from './controllers/access.controller';
import { ACCESS_STORE, type AccessStore } from './interfaces/access-store.interface';
import { AccessService } from './services/access.service';
import { SeatAllowanceService } from './services/seat-allowance.service';
import { ListAccess } from './use-cases/list-access.use-case';
import { ReadSeatConsumption } from './use-cases/read-seat-consumption.use-case';

/**
 * `identity/access` — FR-56, UC-59 (task 131), and the interim seat ceiling's source (task 142).
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
 * **It exports `SEAT_ALLOWANCE` since task 142**, because a seat is a row of this union: the ceiling's
 * rule, its refusals and its source live here, and `identity/invitation` — whose issue and acceptance
 * are the gates — imports this module to reach it. That direction is the honest one; the gates depend on the
 * definition of a seat, and the definition depends on nothing they own. Task 54.2 replaces the
 * provider below with an entitlement-backed one, and the export is what makes that one line.
 *
 * Wired as its siblings are: the use cases carry no `@Injectable()` — `domain-free-of-frameworks`
 * forbids a NestJS import in `use-cases/` — so they have no constructor metadata for Nest to read and
 * are constructed by `useFactory` naming their tokens.
 *
 * **Nothing here is registered on the worker.** The outbox routes no job to a read model, and no
 * worker path invites or accepts.
 */
const { mode } = configuration();

const httpProviders: Provider[] = [
  AccessService,
  { provide: ACCESS_STORE, useClass: AccessStoreRepository },
  { provide: SEAT_ALLOWANCE, useClass: SeatAllowanceService },
  {
    provide: ListAccess,
    inject: [ACCESS_STORE],
    useFactory: (store: AccessStore) => new ListAccess(store),
  },
  {
    provide: ReadSeatConsumption,
    inject: [ACCESS_STORE, SEAT_ALLOWANCE],
    useFactory: (store: AccessStore, seats: SeatAllowance) => new ReadSeatConsumption(store, seats),
  },
];

@Module({
  controllers: mode === APP_MODE.WORKER ? [] : [AccessController],
  providers: mode === APP_MODE.WORKER ? [] : httpProviders,
  exports: mode === APP_MODE.WORKER ? [] : [SEAT_ALLOWANCE],
})
export class AccessModule {}
