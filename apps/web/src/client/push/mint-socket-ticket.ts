import { readResultObject } from '@easyesg/contracts';

/** How a mint ended — a ticket, a session that will not be given one, or no answer worth trusting. */
export const TICKET_MINT = {
  ISSUED: 'issued',
  /** The session is gone or may not open a socket; trying again would be refused again. */
  REFUSED: 'refused',
  /** The mint could not be made or read; a later try may succeed. */
  FAILED: 'failed',
} as const;

export type TicketMint =
  | { readonly kind: typeof TICKET_MINT.ISSUED; readonly ticket: string }
  | { readonly kind: typeof TICKET_MINT.REFUSED | typeof TICKET_MINT.FAILED };

const TICKET_PATH = '/api/v1/session/socket-ticket';

/** Refusals that say the session itself will not be given a ticket, whatever the next try does. */
const REFUSING_STATUSES: ReadonlySet<number> = new Set([401, 403]);

/**
 * `POST /api/v1/session/socket-ticket` through the token-attaching pass-through (task 149; §12.5.6's task-147 ticket
 * row) — the one request the socket needs from the web tier, and an ordinary one: the pass-through attaches the
 * session's bearer and its same-origin proof covers the POST, so nothing here knows a token exists (AD-9).
 *
 * **It answers, never throws**, like every read a poll makes: the socket is an accelerator, and a mint that fails
 * leaves the screen on its poll. A refusal is told apart from a failure because the connection parks on the first and
 * backs off on the second (`reconnect-policy.ts`).
 */
export async function mintSocketTicket(input: { readonly fetch?: typeof fetch } = {}): Promise<TicketMint> {
  const send = input.fetch ?? fetch;
  try {
    const response = await send(TICKET_PATH, {
      method: 'POST',
      headers: { accept: 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (REFUSING_STATUSES.has(response.status)) return { kind: TICKET_MINT.REFUSED };
    if (!response.ok) return { kind: TICKET_MINT.FAILED };
    const { object } = readResultObject<{ ticket?: unknown }>(await response.json(), TICKET_PATH);
    const ticket = object?.ticket;
    return typeof ticket === 'string' && ticket !== ''
      ? { kind: TICKET_MINT.ISSUED, ticket }
      : { kind: TICKET_MINT.FAILED };
  } catch {
    return { kind: TICKET_MINT.FAILED };
  }
}
