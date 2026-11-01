/**
 * The account's live sockets across every api replica (task 147; §12.5.6's task-147 edge row, amended 23 Sep 2026) —
 * **the connection cap's accounting, in Redis**, so ten per account holds however many replicas there are.
 *
 * A socket itself stays in the replica that accepted it; this knows only which replica holds which connection. When a
 * registration pushes an account past the cap, the oldest connection is named to **its own** replica, wherever that is,
 * through the handler that replica gave `onEviction`.
 */
export interface SocketPresence {
  /** Counts a new connection, and has the account's oldest past the cap closed by the replica holding it. */
  register(input: { readonly accountId: string; readonly connectionId: string }): Promise<void>;
  unregister(input: { readonly accountId: string; readonly connectionId: string }): Promise<void>;
  /** What this replica does with a connection of its own the cap has pushed out — closes it. */
  onEviction(handler: (connectionId: string) => void): void;
}

export const SOCKET_PRESENCE = Symbol('SOCKET_PRESENCE');
