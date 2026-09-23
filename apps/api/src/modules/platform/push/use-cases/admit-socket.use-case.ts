import type { Clock } from '@api/contracts/clock.port';
import type { RequestIdentityStore } from '@api/modules/identity/session/interfaces/request-identity-store.interface';
import { sessionAdmitsSocket } from '../domain/session-admits-socket';
import type { HintAudience } from '../domain/push-hint';
import type { SocketTicketStore } from '../interfaces/socket-ticket-store.interface';

/** Whose socket it is, and where that account belonged when it was admitted. */
export type SocketAudience = HintAudience;

/**
 * The upgrade's admission (task 147): the ticket is spent, **whatever happens next** — so a ticket presented twice
 * fails the second time even when the first was refused — and the session it named is re-read the way `AuthGuard`
 * reads a bearer's. Answers the account the socket belongs to and the organizations it is an active member of — what
 * an organization-routed hint reaches (task 148) — or null for every refusal alike: a caller learns nothing from which
 * one it was.
 */
export class AdmitSocket {
  constructor(
    private readonly tickets: SocketTicketStore,
    private readonly identities: RequestIdentityStore,
    private readonly now: Clock,
  ) {}

  async execute(command: { readonly ticket: string }): Promise<SocketAudience | null> {
    const sessionId = await this.tickets.consume({ ticket: command.ticket });
    if (sessionId === null) return null;

    const identity = await this.identities.resolve(sessionId);
    if (identity === null || !sessionAdmitsSocket(identity, this.now())) return null;
    return {
      accountId: identity.accountId,
      organizationIds: identity.memberships.map((membership) => membership.organizationId),
    };
  }
}
