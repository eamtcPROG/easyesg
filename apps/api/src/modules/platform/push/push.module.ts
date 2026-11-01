import { Module, type Provider } from '@nestjs/common';
import configuration, { APP_MODE } from '@api/config/configuration';
import { CLOCK, type Clock } from '@api/contracts/clock.port';
import { PUSH_PUBLISHER } from '@api/contracts/push.port';
import { RedisPushFeed } from '@api/infrastructure/adapters/push/redis-push-feed';
import { RedisPushPublisher } from '@api/infrastructure/adapters/push/redis-push-publisher';
import { RedisSocketPresence } from '@api/infrastructure/adapters/socket-presence/redis-socket-presence';
import { RedisSocketTicketStore } from '@api/infrastructure/adapters/socket-ticket/redis-socket-ticket-store';
import {
  REQUEST_IDENTITY_STORE,
  type RequestIdentityStore,
} from '@api/modules/identity/session/interfaces/request-identity-store.interface';
import { SessionModule } from '@api/modules/identity/session/session.module';
import { PushHintHandler } from './consumers/push-hint.handler';
import { SocketTicketController } from './controllers/socket-ticket.controller';
import { PUSH_FEED } from './interfaces/push-feed.interface';
import { SOCKET_PRESENCE } from './interfaces/socket-presence.interface';
import { SOCKET_TICKET_STORE, type SocketTicketStore } from './interfaces/socket-ticket-store.interface';
import { SocketGateway } from './gateways/socket.gateway';
import { SocketAdmissionService } from './services/socket-admission.service';
import { SocketTicketService } from './services/socket-ticket.service';
import { AdmitSocket } from './use-cases/admit-socket.use-case';
import { IssueSocketTicket } from './use-cases/issue-socket-ticket.use-case';

/**
 * `platform/push` — AD-15's accelerator; NFR-110 (§17.5, added 23 Sep 2026 with task 147).
 *
 * The socket-ticket route, the Redis ticket store, the admission that re-reads the session before the handshake, and
 * the socket itself — a Nest gateway on the api's own HTTP server, through `TicketWsAdapter` (§12.5.6's task-147 rows). Task 148 adds the fan-out of the worker's hints.
 *
 * **The socket is the HTTP side's**; the worker publishes hints (task 148) and serves no socket. **It imports `SessionModule` for the session
 * read**, `REQUEST_IDENTITY_STORE` — the one `AuthGuard` uses, so a socket is admitted by the same read a request is.
 */
const { mode } = configuration();

const httpProviders: Provider[] = [
  { provide: CLOCK, useValue: () => new Date() },
  { provide: SOCKET_TICKET_STORE, useClass: RedisSocketTicketStore },
  // The connection cap across replicas (the task-147 edge row, amended 23 Sep 2026).
  { provide: SOCKET_PRESENCE, useClass: RedisSocketPresence },
  // The worker's hints, heard from this replica's first socket on (task 148).
  { provide: PUSH_FEED, useClass: RedisPushFeed },
  {
    // Framework-free, so `useFactory` over its ports (`apps/api/CLAUDE.md`, "No `@Injectable` means no `useClass`").
    provide: IssueSocketTicket,
    inject: [SOCKET_TICKET_STORE, CLOCK],
    useFactory: (store: SocketTicketStore, now: Clock) => new IssueSocketTicket(store, now),
  },
  {
    provide: AdmitSocket,
    inject: [SOCKET_TICKET_STORE, REQUEST_IDENTITY_STORE, CLOCK],
    useFactory: (store: SocketTicketStore, identities: RequestIdentityStore, now: Clock) =>
      new AdmitSocket(store, identities, now),
  },
  SocketTicketService,
  SocketAdmissionService,
  SocketGateway,
];

/**
 * The worker's half (task 148): the handler that publishes a request-tier hint as the outbox drains, and the publisher
 * it uses. The notification module provides its own publisher for the in-app deliveries it writes — importing this
 * module there would close a module cycle through the session module.
 */
const workerProviders: Provider[] = [{ provide: PUSH_PUBLISHER, useClass: RedisPushPublisher }, PushHintHandler];

@Module({
  imports: mode === APP_MODE.WORKER ? [] : [SessionModule],
  controllers: mode === APP_MODE.WORKER ? [] : [SocketTicketController],
  providers: mode === APP_MODE.WORKER ? workerProviders : httpProviders,
})
export class PushModule {}
