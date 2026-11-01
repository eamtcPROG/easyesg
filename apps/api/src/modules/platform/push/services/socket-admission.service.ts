import type { IncomingMessage } from 'node:http';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '@api/config/configuration';
import type { HintAudience } from '../domain/push-hint';
import { judgeUpgrade } from '../domain/upgrade-request';
import { SocketTicketService } from './socket-ticket.service';

/** Answered when the admission itself failed — Redis or the database unreachable — rather than refused a ticket. */
const UNAVAILABLE = 503;
const UNAUTHORIZED = 401;

export type UpgradeVerdict = { readonly admitted: true } | { readonly admitted: false; readonly status: number };

/**
 * The upgrade's admission, **before the handshake** (task 147; §12.5.6's task-147 ticket row) — what `TicketWsAdapter`
 * asks through `ws`'s `verifyClient`, so every refusal is an HTTP status on the upgrade response and a refused client
 * never holds a socket. Origin, then ticket; the ticket is spent and its session re-read (`AdmitSocket`).
 *
 * **It remembers which account each admitted upgrade request was for**, keyed by the request object, so the gateway's
 * `handleConnection` — which `ws` hands the same request — knows whose socket it is without a second read. A weak map:
 * a request that never became a connection is forgotten with it.
 */
@Injectable()
export class SocketAdmissionService {
  private readonly logger = new Logger(SocketAdmissionService.name);
  private readonly admitted = new WeakMap<IncomingMessage, HintAudience>();
  private readonly allowedOrigin: string;

  constructor(
    private readonly tickets: SocketTicketService,
    config: ConfigService<AppConfig, true>,
  ) {
    this.allowedOrigin = config.get('web.publicUrl', { infer: true });
  }

  async verify(request: IncomingMessage): Promise<UpgradeVerdict> {
    const judgement = judgeUpgrade({ url: request.url, origin: request.headers.origin, allowedOrigin: this.allowedOrigin });
    if (judgement.refused !== null) return { admitted: false, status: judgement.refused };

    try {
      const admission = await this.tickets.admit({ ticket: judgement.ticket });
      if (admission === null) return { admitted: false, status: UNAUTHORIZED };
      this.admitted.set(request, admission);
      return { admitted: true };
    } catch (error) {
      // Never the ticket in the log: it is a credential until it is spent.
      this.logger.error(`Socket admission failed: ${error instanceof Error ? error.message : String(error)}`);
      return { admitted: false, status: UNAVAILABLE };
    }
  }

  /** Whose an admitted upgrade was, and where that account belonged — null for a request this service never admitted. */
  audienceOf(request: IncomingMessage): HintAudience | null {
    return this.admitted.get(request) ?? null;
  }
}
