import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { Inject, type OnApplicationShutdown } from '@nestjs/common';
import {
  WebSocketGateway,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  type OnGatewayInit,
} from '@nestjs/websockets';
import type { WebSocket } from 'ws';
import { SOCKET_CLOSE, SOCKET_LIMIT, SOCKET_PATH } from '../constants/socket.constants';
import { frameOf, hintReaches, type HintAudience, type PushHint } from '../domain/push-hint';
import { PUSH_FEED, type PushFeed } from '../interfaces/push-feed.interface';
import { SOCKET_PRESENCE, type SocketPresence } from '../interfaces/socket-presence.interface';
import { SocketAdmissionService } from '../services/socket-admission.service';

/** What a replica keeps about a connection it holds: its id in the presence, and whose it is (AD-15). */
interface HeldConnection extends HintAudience {
  readonly connectionId: string;
  /**
   * Its registration in the presence, still in flight or done. **A removal waits for it**: a connection closed before
   * its registration reached Redis would otherwise be removed first — removing nothing — and then added, counted
   * against its account for as long as this replica lives.
   */
  readonly registered: Promise<void>;
}

/**
 * AD-15's socket, as a Nest gateway on the api's own HTTP server (task 147; §12.5.6's task-147 rows) — **served by the
 * api process**, the owner's placement, and **a gateway rather than a bare `ws` server**, the owner's second call:
 * the convention a NestJS reader expects. `gateways/` is this module's one addition to the anatomy — a gateway is a
 * transport adapter, as a controller is.
 *
 * **Every connection that reaches `handleConnection` was admitted already**, by `TicketWsAdapter`'s `verifyClient`
 * before the handshake. **The socket stays here; its count is Redis's** (the owner's third call): each connection is
 * registered in `SOCKET_PRESENCE`, which holds ten per account across every replica and has the oldest past that
 * closed by whichever replica holds it (`4001`) — this one closes its own when told. A client frame of any kind closes
 * the connection (`1008`), since frames are server→client only and the gateway declares no message handler; `ws`
 * refuses a payload over 1 KiB before it is buffered; and a heartbeat ends connections that stop answering pings.
 *
 * **It sends frames, and only frames** (task 148): with its first connection it subscribes to the worker's hints, and
 * each hint goes to the connections it reaches — an account's own, or every member of an organization — as the
 * three-field frame `frameOf` builds, so the accounts a hint was routed by never reach a browser. Nothing here reads
 * tenant data (AD-2); what a frame makes a client do is its own authorized refetch.
 */
@WebSocketGateway({ path: SOCKET_PATH, maxPayload: SOCKET_LIMIT.MAX_CLIENT_PAYLOAD_BYTES })
export class SocketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnApplicationShutdown {
  /** The connections this replica holds, by their presence id — what an eviction names. */
  private readonly byId = new Map<string, WebSocket>();
  private readonly held = new WeakMap<WebSocket, HeldConnection>();
  /** Connections that answered the last ping; one absent at the next sweep is ended. */
  private readonly answered = new WeakSet<WebSocket>();
  private heartbeat: NodeJS.Timeout | undefined;

  constructor(
    private readonly admissions: SocketAdmissionService,
    @Inject(SOCKET_PRESENCE) private readonly presence: SocketPresence,
    @Inject(PUSH_FEED) private readonly feed: PushFeed,
  ) {}

  afterInit(): void {
    this.presence.onEviction((connectionId) => {
      this.byId.get(connectionId)?.close(SOCKET_CLOSE.SUPERSEDED, 'superseded by a newer connection');
    });
    this.heartbeat = setInterval(() => this.sweep(), SOCKET_LIMIT.HEARTBEAT_MS);
    this.heartbeat.unref();
  }

  handleConnection(connection: WebSocket, request: IncomingMessage): void {
    const audience = this.admissions.audienceOf(request);
    // Unreachable while the adapter is `TicketWsAdapter`; closed rather than trusted if that ever changes.
    if (audience === null) {
      connection.close(SOCKET_CLOSE.CLIENT_FRAME, 'not admitted');
      return;
    }
    const { accountId, organizationIds } = audience;
    const connectionId = randomUUID();
    this.byId.set(connectionId, connection);
    this.held.set(connection, {
      connectionId,
      accountId,
      organizationIds,
      registered: this.presence.register({ accountId, connectionId }),
    });
    void this.feed.start((hint) => this.deliver(hint));
    this.answered.add(connection);
    connection.on('pong', () => this.answered.add(connection));
    connection.on('message', () => connection.close(SOCKET_CLOSE.CLIENT_FRAME, 'frames are server to client only'));
  }

  handleDisconnect(connection: WebSocket): void {
    const held = this.held.get(connection);
    if (held === undefined) return;
    this.byId.delete(held.connectionId);
    const { accountId, connectionId } = held;
    void held.registered.then(() => this.presence.unregister({ accountId, connectionId }));
  }

  onApplicationShutdown(): void {
    clearInterval(this.heartbeat);
    for (const connection of this.byId.values()) connection.close(SOCKET_CLOSE.SHUTTING_DOWN, 'shutting down');
  }

  /** One hint to every connection here it reaches, as the frame. A connection closing is skipped, not an error. */
  private deliver(hint: PushHint): void {
    const frame = JSON.stringify(frameOf(hint));
    for (const connection of this.byId.values()) {
      const held = this.held.get(connection);
      if (held !== undefined && connection.readyState === connection.OPEN && hintReaches(hint, held)) {
        connection.send(frame);
      }
    }
  }

  private sweep(): void {
    for (const connection of this.byId.values()) {
      if (!this.answered.has(connection)) {
        connection.terminate();
        continue;
      }
      this.answered.delete(connection);
      connection.ping();
    }
  }
}
