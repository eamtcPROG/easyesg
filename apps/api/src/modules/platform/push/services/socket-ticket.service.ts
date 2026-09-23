import { Injectable } from '@nestjs/common';
import { requestContext } from '@api/infrastructure/persistence/request-context';
import { AuthenticationRequiredError } from '@api/modules/identity/membership/errors/membership.errors';
import { AdmitSocket } from '../use-cases/admit-socket.use-case';
import { IssueSocketTicket } from '../use-cases/issue-socket-ticket.use-case';

/**
 * The seam between AD-15's socket and its two use cases (task 147), and where the ambient value is resolved: **the
 * session a ticket names is the request's own**, from the context `AuthGuard` filled — never from the body, or a
 * caller could mint a ticket for someone else's session.
 */
@Injectable()
export class SocketTicketService {
  constructor(
    private readonly issueTicket: IssueSocketTicket,
    private readonly admitSocket: AdmitSocket,
  ) {}

  issue(): Promise<{ readonly ticket: string; readonly expiresAt: Date }> {
    const sessionId = requestContext()?.sessionId;
    if (sessionId === undefined) throw new AuthenticationRequiredError();
    return this.issueTicket.execute({ sessionId });
  }

  admit(input: { readonly ticket: string }): Promise<{ readonly accountId: string } | null> {
    return this.admitSocket.execute(input);
  }
}
