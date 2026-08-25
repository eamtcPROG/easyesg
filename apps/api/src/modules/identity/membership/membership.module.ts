import { Module, type Provider } from '@nestjs/common';
import configuration, { APP_MODE } from '@api/config/configuration';
import { CLOCK, type Clock } from '@api/contracts/clock.port';
import { MembershipStoreRepository } from '@api/infrastructure/persistence/identity/membership-store.repository';
import { MembersController } from './controllers/members.controller';
import { MembershipsController } from './controllers/memberships.controller';
import {
  ACCOUNT_MEMBERSHIP_STORE,
  type AccountMembershipStore,
} from './interfaces/account-membership-store.interface';
import { MEMBERSHIP_STORE, type MembershipStore } from './interfaces/membership-store.interface';
import { AccountMembershipStoreRepository } from '@api/infrastructure/persistence/identity/account-membership-store.repository';
import { MembershipService } from './services/membership.service';
import { ChangeMemberRole } from './use-cases/change-member-role.use-case';
import { ListMembers } from './use-cases/list-members.use-case';
import { ListOwnMemberships } from './use-cases/list-own-memberships.use-case';
import { RemoveMember } from './use-cases/remove-member.use-case';

/**
 * `identity/membership` — FR-12, FR-56, FR-58, FR-59, FR-60
 *
 * Organization membership and the role held in it. Revocation without cascading historical
 * attribution (FR-55): removal is a status change, and no runtime role holds `DELETE` on the table.
 *
 * Boundary: `modules/core/**` and `modules/billing/**` may not import each other.
 * Both may import `contracts/**`. Enforced by dependency-cruiser, not by review.
 *
 * Wired as `AccountModule` is: use cases carry no `@Injectable()` — `domain-free-of-frameworks`
 * forbids a NestJS import in `use-cases/` — so they have no constructor metadata for Nest to read
 * and are constructed by `useFactory` naming their tokens. One clock for the module (P-7).
 *
 * **Nothing here is registered on the worker.** The outbox routes no job to this module: a role
 * change is synchronous and has no notification of its own (FR-57's invitation email is task
 * 26.1's, and it belongs to the invitation, not to the membership it eventually creates).
 */
const { mode } = configuration();

const httpProviders: Provider[] = [
  MembershipService,
  { provide: MEMBERSHIP_STORE, useClass: MembershipStoreRepository },
  /**
   * Two stores, because the two reads run at different moments in the request (task 25.3): one on
   * the request's tenant transaction, one before a tenant exists. The ports say why; registering
   * both here is what keeps a caller from reaching for whichever it can see.
   */
  { provide: ACCOUNT_MEMBERSHIP_STORE, useClass: AccountMembershipStoreRepository },
  { provide: CLOCK, useValue: () => new Date() },
  {
    provide: ListMembers,
    inject: [MEMBERSHIP_STORE],
    useFactory: (store: MembershipStore) => new ListMembers(store),
  },
  {
    provide: ListOwnMemberships,
    inject: [ACCOUNT_MEMBERSHIP_STORE],
    useFactory: (store: AccountMembershipStore) => new ListOwnMemberships(store),
  },
  {
    provide: ChangeMemberRole,
    inject: [MEMBERSHIP_STORE, CLOCK],
    useFactory: (store: MembershipStore, now: Clock) => new ChangeMemberRole(store, now),
  },
  {
    provide: RemoveMember,
    inject: [MEMBERSHIP_STORE, CLOCK],
    useFactory: (store: MembershipStore, now: Clock) => new RemoveMember(store, now),
  },
];

@Module({
  controllers: mode === APP_MODE.WORKER ? [] : [MembersController, MembershipsController],
  providers: mode === APP_MODE.WORKER ? [] : httpProviders,
})
export class MembershipModule {}
