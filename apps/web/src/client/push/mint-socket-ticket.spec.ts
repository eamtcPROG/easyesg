import { describe, expect, it, vi } from 'vitest';
import { TICKET_MINT, mintSocketTicket } from './mint-socket-ticket';

const answering = (status: number, body: unknown) =>
  vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(body), { status }));

/** The socket's one web-tier request (task 149): a ticket, a refusal the connection parks on, or a failure. */
describe('mintSocketTicket', () => {
  it('posts through the pass-through with the session cookie and reads the ticket from the envelope', async () => {
    const send = answering(201, { object: { ticket: 't-1', expiresAt: 1 }, messages: [] });

    await expect(mintSocketTicket({ fetch: send })).resolves.toEqual({ kind: TICKET_MINT.ISSUED, ticket: 't-1' });
    expect(send).toHaveBeenCalledWith(
      '/api/v1/session/socket-ticket',
      expect.objectContaining({ method: 'POST', credentials: 'same-origin', cache: 'no-store' }),
    );
  });

  it.each([
    ['no session', answering(401, { type: 'authentication-required' })],
    ['a session that may not open one', answering(403, { type: 'account-setup-required' })],
  ])('is refused for %s', async (_case, send) => {
    await expect(mintSocketTicket({ fetch: send })).resolves.toEqual({ kind: TICKET_MINT.REFUSED });
  });

  it.each([
    ['a server error', answering(503, {})],
    ['a body that is not the envelope', answering(201, { ticket: 't-1' })],
    ['an empty ticket', answering(201, { object: { ticket: '' }, messages: [] })],
    ['no answer', vi.fn<typeof fetch>().mockRejectedValue(new TypeError('offline'))],
  ])('fails for %s', async (_case, send) => {
    await expect(mintSocketTicket({ fetch: send })).resolves.toEqual({ kind: TICKET_MINT.FAILED });
  });
});
