import { SOCKET_PATH, SOCKET_TICKET_PARAMETER } from '@easyesg/contracts';

/** The URL schemes the api is reached by, and the socket's counterpart of each. */
const SCHEME = { TLS: 'https:', SECURE_SOCKET: 'wss:', SOCKET: 'ws:' } as const;

/**
 * Where a ticket opens the socket (task 149; AD-15) — the api's own origin, the socket's path, and the ticket as the
 * query parameter a browser `WebSocket` has to use, since it sets no headers (§12.5.6's task-147 ticket row).
 *
 * **The origin is `PUBLIC_API_URL`'s**, handed down by the server (`lib/env.ts`), and any path on it is ignored: the
 * socket's path is the contract's. `wss:` wherever the api is served over TLS.
 */
export const socketAddress = (input: { readonly apiOrigin: string; readonly ticket: string }): string => {
  const address = new URL(SOCKET_PATH, input.apiOrigin);
  address.protocol = address.protocol === SCHEME.TLS ? SCHEME.SECURE_SOCKET : SCHEME.SOCKET;
  address.searchParams.set(SOCKET_TICKET_PARAMETER, input.ticket);
  return address.toString();
};
