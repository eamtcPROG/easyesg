/**
 * AD-15's socket as a client meets it (task 149; §12.5.6's task-147 and task-149 rows) — where it is, how the ticket
 * reaches it, and why it was closed.
 *
 * **A second copy of the api's `platform/push/constants/socket.constants.ts`, on purpose and gated**, for the reason
 * the event names have one: the api may not import this package (`api-not-to-contracts-package`). `pnpm events:check`
 * fails when the two disagree — without it, a path renamed on one side would leave every client polling with no
 * socket, which the poll floor makes invisible on every screen. **No import at all**, because the checker loads this
 * file directly under Node's type stripping.
 */

/** The upgrade's path on the api's own origin. */
export const SOCKET_PATH = '/api/v1/socket';

/** The query parameter the ticket arrives in — a browser `WebSocket` sets no headers. */
export const SOCKET_TICKET_PARAMETER = 'ticket';

/** Why the api ends a socket. The client reads the code to decide whether, and when, to open another. */
export const SOCKET_CLOSE = {
  /** The client sent a frame, which it never does. */
  CLIENT_FRAME: 1008,
  /** The account opened more connections than the cap and this one was the oldest. */
  SUPERSEDED: 4001,
  /** The replica is shutting down; another will take the next connection. */
  SHUTTING_DOWN: 1001,
} as const;

export type SocketCloseCode = (typeof SOCKET_CLOSE)[keyof typeof SOCKET_CLOSE];
