import { STATUS_CODES, type IncomingMessage, type Server } from 'node:http';
import type { Duplex } from 'node:stream';
import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpAdapterHost } from '@nestjs/core';
import { WebSocketServer, type WebSocket } from 'ws';
import type { AppConfig } from '@api/config/configuration';
import { SOCKET_CLOSE, SOCKET_LIMIT } from '../constants/socket.constants';
import { SocketRegistry } from '../domain/socket-registry';
import { judgeUpgrade } from '../domain/upgrade-request';
import { SocketTicketService } from './socket-ticket.service';

/** Answered when the admission itself failed — Redis or the database unreachable — rather than refused a ticket. */
const UNAVAILABLE = 503;

/**
 * AD-15's socket, on the api's own HTTP server (task 147; §12.5.6's task-147 rows) — **served by the api process**, the
 * owner's placement: no third role, no separate service.
 *
 * **The upgrade is judged before any socket exists.** Path, origin and ticket are read from the HTTP request, the
 * ticket is spent and its session re-read, and only then does `ws` complete the handshake — so every refusal is an
 * HTTP status on the upgrade response (`judgeUpgrade`'s three, and 401 for a ticket that admits nothing), and a refused
 * client never holds a socket. This is why `ws` runs in `noServer` mode rather than behind a Nest gateway, whose
 * connection hook runs after the handshake is accepted (§12.1's AD-15 row).
 *
 * **The caps, per replica, until the edge** (the task-147 edge row): ten connections per account with the oldest
 * closed; a client frame of any kind closes the connection, since frames are server→client only; and `ws` refuses a
 * payload over 1 KiB before it is buffered. A heartbeat ends connections that stop answering pings, so a laptop that
 * slept does not hold a place under the cap.
 *
 * **It sends nothing yet**: the frames and their fan-out are task 148's. Nothing here reads tenant data (AD-2).
 */
@Injectable()
export class SocketServer implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(SocketServer.name);
  private readonly sockets = new WebSocketServer({ noServer: true, maxPayload: SOCKET_LIMIT.MAX_CLIENT_PAYLOAD_BYTES });
  private readonly registry = new SocketRegistry<WebSocket>(SOCKET_LIMIT.CONNECTIONS_PER_ACCOUNT);
  /** Connections that answered the last ping; one absent at the next sweep is ended. */
  private readonly answered = new WeakSet<WebSocket>();
  private readonly allowedOrigin: string;
  private heartbeat: NodeJS.Timeout | undefined;

  constructor(
    private readonly adapterHost: HttpAdapterHost,
    private readonly tickets: SocketTicketService,
    config: ConfigService<AppConfig, true>,
  ) {
    this.allowedOrigin = config.get('web.publicUrl', { infer: true });
  }

  onApplicationBootstrap(): void {
    // An application context — the worker's factory, and the boot specs that use it in HTTP mode — has no HTTP server
    // and so no upgrade to take. Nest types the adapter as always present; it is not.
    const adapter = this.adapterHost.httpAdapter as HttpAdapterHost['httpAdapter'] | null;
    if (adapter === null) return;
    const server = adapter.getHttpServer() as Server;
    server.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
      void this.upgrade({ request, socket, head });
    });
    this.heartbeat = setInterval(() => this.sweep(), SOCKET_LIMIT.HEARTBEAT_MS);
    this.heartbeat.unref();
  }

  onApplicationShutdown(): void {
    clearInterval(this.heartbeat);
    for (const socket of this.registry.all()) socket.close(SOCKET_CLOSE.SHUTTING_DOWN, 'shutting down');
    this.sockets.close();
  }

  private async upgrade(input: { request: IncomingMessage; socket: Duplex; head: Buffer }): Promise<void> {
    const { request, socket, head } = input;
    const judgement = judgeUpgrade({ url: request.url, origin: request.headers.origin, allowedOrigin: this.allowedOrigin });
    if (judgement.refused !== null) return refuse(socket, judgement.refused);

    let admitted: { readonly accountId: string } | null;
    try {
      admitted = await this.tickets.admit({ ticket: judgement.ticket });
    } catch (error) {
      // Never the ticket in the log: it is a credential until it is spent.
      this.logger.error(`Socket admission failed: ${error instanceof Error ? error.message : String(error)}`);
      return refuse(socket, UNAVAILABLE);
    }
    if (admitted === null) return refuse(socket, 401);

    const { accountId } = admitted;
    this.sockets.handleUpgrade(request, socket, head, (connection) => this.accept({ connection, accountId }));
  }

  private accept(input: { connection: WebSocket; accountId: string }): void {
    const { connection, accountId } = input;
    for (const superseded of this.registry.add({ accountId, socket: connection })) {
      superseded.close(SOCKET_CLOSE.SUPERSEDED, 'superseded by a newer connection');
    }
    this.answered.add(connection);
    connection.on('pong', () => this.answered.add(connection));
    connection.on('message', () => connection.close(SOCKET_CLOSE.CLIENT_FRAME, 'frames are server to client only'));
    connection.on('close', () => this.registry.remove({ accountId, socket: connection }));
    connection.on('error', () => connection.terminate());
  }

  private sweep(): void {
    for (const connection of this.registry.all()) {
      if (!this.answered.has(connection)) {
        connection.terminate();
        continue;
      }
      this.answered.delete(connection);
      connection.ping();
    }
  }
}

/** An HTTP answer on the upgrade's raw socket, then the socket ended — nothing was ever a WebSocket. */
const refuse = (socket: Duplex, status: number): void => {
  socket.end(`HTTP/1.1 ${status} ${STATUS_CODES[status] ?? ''}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
};
