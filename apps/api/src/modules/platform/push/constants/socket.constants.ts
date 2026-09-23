/**
 * AD-15's socket, as values (task 147; §12.5.6's task-147 rows). **The limits are the owner's**, set 23 Sep 2026 and
 * recorded there as instructions task 71's edge honours; until the edge exists the api enforces the first three per
 * replica.
 */
export const SOCKET_PATH = '/api/v1/socket';

/** The query parameter the ticket arrives in — a browser `WebSocket` sets no headers (the task-147 ticket row). */
export const SOCKET_TICKET_PARAMETER = 'ticket';

export const SOCKET_LIMIT = {
  /** Open connections per account per replica; the oldest is closed when another arrives. */
  CONNECTIONS_PER_ACCOUNT: 10,
  /** Frames are server→client only, so anything a client sends is at most this, and closes the connection anyway. */
  MAX_CLIENT_PAYLOAD_BYTES: 1024,
  /** How often a connection must answer a ping, or be ended as dead. */
  HEARTBEAT_MS: 30_000,
} as const;

/** How long an issued ticket lives unused, in seconds — the row's ≤30 s. */
export const SOCKET_TICKET_TTL_SECONDS = 30;

/**
 * Why the api ends a socket, as WebSocket close codes. `1008` is RFC 6455's *policy violation*; the 4000 range is the
 * application's own, and task 149's client reads it to decide whether to reconnect.
 */
export const SOCKET_CLOSE = {
  /** The client sent a frame. */
  CLIENT_FRAME: 1008,
  /** The account opened more connections than the cap; this one was the oldest. */
  SUPERSEDED: 4001,
  /** The api is shutting down; the client reconnects to another replica, polling meanwhile. */
  SHUTTING_DOWN: 1001,
} as const;
