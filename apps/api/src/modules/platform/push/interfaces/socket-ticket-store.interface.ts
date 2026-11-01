/**
 * Where an issued socket ticket waits for its one use (task 147; §12.5.6's task-147 ticket row: Redis, a 30 s expiry,
 * an atomic get-and-delete). **Single-use is the store's to guarantee**, not the caller's to check: `consume` answers
 * the session once and never again, however many callers race for it.
 */
export interface SocketTicketStore {
  /** Stores a fresh ticket naming the session, living `ttlSeconds`; answers the ticket. */
  issue(input: { readonly sessionId: string; readonly ttlSeconds: number }): Promise<string>;
  /** The session a live, unused ticket names — removing it in the same step — or null. */
  consume(input: { readonly ticket: string }): Promise<string | null>;
}

export const SOCKET_TICKET_STORE = Symbol('SOCKET_TICKET_STORE');
