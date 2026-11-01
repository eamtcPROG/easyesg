import type { IncomingMessage } from 'node:http';
import type { INestApplicationContext } from '@nestjs/common';
import { WsAdapter } from '@nestjs/platform-ws';
import { SocketAdmissionService } from '../services/socket-admission.service';

/** `ws`'s `verifyClient`, in its asynchronous form — the callback answers accept, or refuse with an HTTP status. */
type VerifyClient = (
  info: { readonly req: IncomingMessage },
  answer: (accept: boolean, status?: number) => void,
) => void;

/**
 * Nest's `WsAdapter`, with the ticket's admission added to every gateway's server as `ws`'s `verifyClient` (task 147).
 *
 * **Why a subclass and not the gateway's own hook**: `handleConnection` runs after `ws` has completed the handshake, so
 * a refusal there is a close after an open. `verifyClient` runs before it, and `ws` writes its refusal as the HTTP
 * status of the upgrade response — which the gateway decorator cannot supply itself, being static options with no
 * access to the container. `WsAdapter.create` spreads the gateway's options into `ws`'s server, so adding one option
 * here is the whole change. Registered in `configureHttpApp`, beside the prefix and the pipes.
 *
 * **The admission service is fetched from the container on first use**, since the adapter is built before the
 * application has initialised its providers.
 */
export class TicketWsAdapter extends WsAdapter {
  private admissions: SocketAdmissionService | undefined;

  constructor(private readonly app: INestApplicationContext) {
    super(app);
  }

  override create(port: number, options: Record<string, unknown> & { path?: string }): unknown {
    const verifyClient: VerifyClient = (info, answer) => {
      const admissions = this.admissionService();
      void admissions.verify(info.req).then((verdict) => {
        if (verdict.admitted) answer(true);
        else answer(false, verdict.status);
      });
    };
    return super.create(port, { ...options, verifyClient });
  }

  private admissionService(): SocketAdmissionService {
    // `strict: false` searches every module, and Nest types that search as possibly finding nothing.
    this.admissions ??= this.app.get<SocketAdmissionService | undefined>(SocketAdmissionService, { strict: false });
    if (this.admissions === undefined) throw new Error('SocketAdmissionService is not provided — is PushModule imported?');
    return this.admissions;
  }
}
