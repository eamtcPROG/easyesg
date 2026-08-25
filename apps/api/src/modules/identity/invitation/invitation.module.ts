import { Module, type Provider } from '@nestjs/common';
import configuration, { APP_MODE } from '@api/config/configuration';
import { CLOCK, type Clock } from '@api/contracts/clock.port';
import { EmailModule } from '@api/infrastructure/adapters/email/email.module';
import { InvitationBearerStoreRepository } from '@api/infrastructure/persistence/identity/invitation-bearer-store.repository';
import { InvitationStoreRepository } from '@api/infrastructure/persistence/identity/invitation-store.repository';
import { InvitationEmailHandler } from './consumers/invitation-email.handler';
import { InvitationAcceptanceController } from './controllers/invitation-acceptance.controller';
import { InvitationsController } from './controllers/invitations.controller';
import {
  INVITATION_BEARER_STORE,
  type InvitationBearerStore,
} from './interfaces/invitation-bearer-store.interface';
import { INVITATION_STORE, type InvitationStore } from './interfaces/invitation-store.interface';
import { InvitationService } from './services/invitation.service';
import { AcceptInvitation } from './use-cases/accept-invitation.use-case';
import { IssueInvitation } from './use-cases/issue-invitation.use-case';
import { PreviewInvitation } from './use-cases/preview-invitation.use-case';
import { ListInvitations } from './use-cases/list-invitations.use-case';
import { ResendInvitation } from './use-cases/resend-invitation.use-case';
import { RevokeInvitation } from './use-cases/revoke-invitation.use-case';

/**
 * `identity/invitation` — FR-11, FR-57
 *
 * Invitation issuance, resend, revocation and expiry. Acceptance (UC-15) is task 26.2 and lands in
 * this module beside them.
 *
 * Boundary: `modules/core/**` and `modules/billing/**` may not import each other.
 * Both may import `contracts/**`. Enforced by dependency-cruiser, not by review.
 *
 * Wired as `AccountModule` and `MembershipModule` are: use cases carry no `@Injectable()` —
 * `domain-free-of-frameworks` forbids a NestJS import in `use-cases/` — so they have no constructor
 * metadata for Nest to read and are constructed by `useFactory` naming their tokens. One clock for
 * the module (P-7).
 *
 * **It is the first identity module split across BOTH entrypoints for one flow.** `AccountModule`
 * splits the same way, but its worker side serves routes that are themselves unauthenticated; here
 * an Organization Administrator's tenant-scoped write on the HTTP side produces work the worker
 * finishes, with the outbox as the only thing joining them (AD-6, AD-10) — the api enqueues
 * nothing, and `esg_worker` holds no grant on `identity.invitation`, so the payload is the entire
 * interface between the two halves.
 */
const { mode } = configuration();

const httpProviders: Provider[] = [
  InvitationService,
  { provide: INVITATION_STORE, useClass: InvitationStoreRepository },
  /**
   * Two stores, because the two callers stand in different places (task 26.2). The administrator's
   * reads and writes ride the request's tenant transaction; the bearer's open their own, since the
   * request's is bound to whichever organization the acceptor is *currently* in — not the one
   * inviting them. The ports say so at length; registering both here is what stops a caller
   * reaching for whichever it can see.
   */
  { provide: INVITATION_BEARER_STORE, useClass: InvitationBearerStoreRepository },
  { provide: CLOCK, useValue: () => new Date() },
  {
    provide: ListInvitations,
    inject: [INVITATION_STORE],
    useFactory: (store: InvitationStore) => new ListInvitations(store),
  },
  {
    provide: IssueInvitation,
    inject: [INVITATION_STORE, CLOCK],
    useFactory: (store: InvitationStore, now: Clock) => new IssueInvitation(store, now),
  },
  {
    provide: ResendInvitation,
    inject: [INVITATION_STORE, CLOCK],
    useFactory: (store: InvitationStore, now: Clock) => new ResendInvitation(store, now),
  },
  {
    provide: RevokeInvitation,
    inject: [INVITATION_STORE, CLOCK],
    useFactory: (store: InvitationStore, now: Clock) => new RevokeInvitation(store, now),
  },
  {
    provide: PreviewInvitation,
    inject: [INVITATION_BEARER_STORE, CLOCK],
    useFactory: (store: InvitationBearerStore, now: Clock) => new PreviewInvitation(store, now),
  },
  {
    provide: AcceptInvitation,
    inject: [INVITATION_BEARER_STORE, CLOCK],
    useFactory: (store: InvitationBearerStore, now: Clock) => new AcceptInvitation(store, now),
  },
];

/** The worker side: whatever `OutboxConsumer` routes to this module by job name. */
const workerProviders: Provider[] = [InvitationEmailHandler];

@Module({
  imports: mode === APP_MODE.WORKER ? [EmailModule] : [],
  controllers:
    mode === APP_MODE.WORKER ? [] : [InvitationsController, InvitationAcceptanceController],
  providers: mode === APP_MODE.WORKER ? workerProviders : httpProviders,
})
export class InvitationModule {}
