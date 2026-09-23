/**
 * The sockets one api replica holds, by account (task 147; §12.5.6's task-147 edge row) — the per-replica half of the
 * connection cap until task 71's edge enforces it across replicas.
 *
 * **Nothing but the account is kept per connection** (AD-15): a reconnect lands on any replica and is admitted
 * afresh, which is what makes no sticky routing safe. **The oldest connection yields** when an account opens one more
 * than the cap — the newest tab is the one being looked at — and the registry names it rather than closing it, so the
 * close code is the caller's.
 */
export interface RegisteredSocket {
  close(code: number, reason: string): void;
}

export class SocketRegistry<TSocket extends RegisteredSocket> {
  private readonly byAccount = new Map<string, TSocket[]>();

  constructor(private readonly capPerAccount: number) {}

  /** Records the socket, and answers the ones the cap now pushes out, oldest first. */
  add(input: { readonly accountId: string; readonly socket: TSocket }): readonly TSocket[] {
    const held = [...(this.byAccount.get(input.accountId) ?? []), input.socket];
    const excess = Math.max(0, held.length - this.capPerAccount);
    this.byAccount.set(input.accountId, held.slice(excess));
    return held.slice(0, excess);
  }

  remove(input: { readonly accountId: string; readonly socket: TSocket }): void {
    const held = (this.byAccount.get(input.accountId) ?? []).filter((socket) => socket !== input.socket);
    if (held.length === 0) this.byAccount.delete(input.accountId);
    else this.byAccount.set(input.accountId, held);
  }

  /** Every socket the replica holds — for shutdown, and from task 148 for fan-out. */
  all(): readonly TSocket[] {
    return [...this.byAccount.values()].flat();
  }

  countFor(accountId: string): number {
    return this.byAccount.get(accountId)?.length ?? 0;
  }
}
