import type { ResolvedRequestIdentity } from '@api/modules/identity/session/interfaces/request-identity-store.interface';
import type { SocketTicketStore } from '../interfaces/socket-ticket-store.interface';
import { AdmitSocket } from './admit-socket.use-case';
import { IssueSocketTicket } from './issue-socket-ticket.use-case';

/**
 * The ticket's life, over a store that models single use (task 147). Literals: the account status's wire value.
 */
describe('IssueSocketTicket and AdmitSocket (task 147)', () => {
  const NOW = new Date('2026-09-23T10:00:00Z');
  const now = () => NOW;

  const store = (): SocketTicketStore & { held: Map<string, string> } => {
    const held = new Map<string, string>();
    return {
      held,
      issue: ({ sessionId }) => {
        const ticket = `ticket-${held.size + 1}`;
        held.set(ticket, sessionId);
        return Promise.resolve(ticket);
      },
      consume: ({ ticket }) => {
        const sessionId = held.get(ticket) ?? null;
        held.delete(ticket);
        return Promise.resolve(sessionId);
      },
    };
  };

  const identity = (overrides: Partial<ResolvedRequestIdentity> = {}): ResolvedRequestIdentity => ({
    accountId: 'account-ana',
    account: { status: 'active', setupExpiresAt: null },
    anchors: { sessionCreatedAt: NOW, tokenIssuedAt: NOW, remembered: true },
    revokedAt: null,
    preferredOrganizationId: null,
    memberships: [],
    ...overrides,
  });

  const admission = (tickets: SocketTicketStore, resolved: ResolvedRequestIdentity | null) =>
    new AdmitSocket(tickets, { resolve: () => Promise.resolve(resolved) }, now);

  it('issues a thirty-second ticket naming the session that asked', async () => {
    const tickets = store();

    await expect(new IssueSocketTicket(tickets, now).execute({ sessionId: 'session-1' })).resolves.toEqual({
      ticket: 'ticket-1',
      expiresAt: new Date('2026-09-23T10:00:30Z'),
    });
    expect(tickets.held.get('ticket-1')).toBe('session-1');
  });

  it('admits a live session once, and refuses the same ticket a second time', async () => {
    const tickets = store();
    const { ticket } = await new IssueSocketTicket(tickets, now).execute({ sessionId: 'session-1' });
    const admit = admission(tickets, identity());

    await expect(admit.execute({ ticket })).resolves.toEqual({ accountId: 'account-ana' });
    await expect(admit.execute({ ticket })).resolves.toBeNull();
  });

  it('refuses a ticket it never issued', async () => {
    await expect(admission(store(), identity()).execute({ ticket: 'forged' })).resolves.toBeNull();
  });

  it.each([
    ['a session ended since the ticket was minted', identity({ revokedAt: NOW })],
    ['an account still completing its setup', identity({ account: { status: 'awaiting_setup', setupExpiresAt: null } })],
    ['a session that no longer exists', null],
  ])('refuses %s — and the ticket is spent all the same', async (_, resolved) => {
    const tickets = store();
    const { ticket } = await new IssueSocketTicket(tickets, now).execute({ sessionId: 'session-1' });

    await expect(admission(tickets, resolved).execute({ ticket })).resolves.toBeNull();
    expect(tickets.held.size).toBe(0);
  });
});
