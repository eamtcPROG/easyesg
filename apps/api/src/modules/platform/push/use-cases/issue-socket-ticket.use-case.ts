import type { Clock } from '@api/contracts/clock.port';
import { SOCKET_TICKET_TTL_SECONDS } from '../constants/socket.constants';
import type { SocketTicketStore } from '../interfaces/socket-ticket-store.interface';

/**
 * A ticket to open AD-15's socket (task 147; §12.5.6's task-147 ticket row): single-use, thirty seconds, naming the
 * session that asked and nothing else — no personal data, so the query string it travels in carries none.
 */
export class IssueSocketTicket {
  constructor(
    private readonly store: SocketTicketStore,
    private readonly now: Clock,
  ) {}

  async execute(command: { readonly sessionId: string }): Promise<{ readonly ticket: string; readonly expiresAt: Date }> {
    const issuedAt = this.now();
    const ticket = await this.store.issue({ sessionId: command.sessionId, ttlSeconds: SOCKET_TICKET_TTL_SECONDS });
    return { ticket, expiresAt: new Date(issuedAt.getTime() + SOCKET_TICKET_TTL_SECONDS * 1000) };
  }
}
