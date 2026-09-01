import http from 'node:http';

/**
 * Closes the sockets a timed-out test abandoned, so jest can exit (task 85, partial).
 *
 * ## What this fixes, and what it does not
 *
 * It fixes the **hang**, not the timeout. Task 85 records eight instances of an e2e run failing, and
 * two things were tangled in that row: a test exceeding jest's 5 000 ms limit, and jest then never
 * exiting. The second is a consequence of the first, and only the second is understood.
 *
 * Caught live on 1 Sep 2026, mid-hang: one test in `invitations.e2e-spec.ts` timed out, 750 of 751
 * passed, and the process then sat **19 minutes at 0.0 % CPU** holding **no database connection** and
 * exactly **one** socket — `TCP localhost:53898->localhost:53897`, a loopback pair. That is
 * supertest's client connection to the in-process server. Only the client end survived, because
 * `app.close()` closed the server and nothing closed the request the timed-out test had abandoned.
 * One referenced handle keeps node's event loop alive, and that is the whole of the non-exit.
 *
 * **The timeout itself remains unexplained**, and it is the half that matters. What changes here is
 * its cost: a one-test flake now fails in seconds instead of stalling a gate run for as long as
 * anyone leaves it.
 *
 * ## Why it closes the server's connections rather than an agent's
 *
 * The obvious global fix is `http.globalAgent.destroy()`, which needs no reference to anything.
 * **It does nothing here, measured rather than assumed**: `superagent/lib/node/index.js` sets
 * `this._agent = false` and passes `options.agent = this._agent`, and `agent: false` tells Node to
 * build a *fresh* agent for that request — so supertest's sockets are never in the global pool. A
 * probe with `agent: false` still hung after `globalAgent.destroy()` and exited immediately after
 * `server.closeAllConnections()`.
 *
 * ## Why it tracks servers instead of each suite passing `forceCloseConnections`
 *
 * Nest supports `forceCloseConnections: true` on `NestFactory.create`, which makes `app.close()` do
 * exactly this. It is the documented API and it was the alternative (project owner, 1 Sep 2026). It
 * loses on one point: twenty-five suites create an app, and the twenty-sixth omitting it produces no
 * visible failure — just a gate run that stalls until someone notices. This has no forgetting mode.
 *
 * The cost is named rather than hidden: it patches `http.Server.prototype.listen` for the test
 * process. That is the clever part, it is why the tracking is a `Set` and nothing more, and it is
 * confined to `test/support`.
 *
 * ## What is proven, and what is not
 *
 * The **mechanism** is proven deterministically, at the node level: an abandoned request with
 * `agent: false` keeps the loop alive after `server.close()`; `globalAgent.destroy()` does not help;
 * `closeAllConnections()` makes the process exit immediately. `close-connections.spec.ts` proves the
 * wiring — that the patch takes effect and that the exported teardown really destroys a live socket.
 *
 * **The in-situ hang was not reproduced.** Two attempts to force it inside a real suite — a 1 ms test
 * limit, and a socket the server still held at teardown — both exited cleanly, so the timing that
 * produces it is not one that can be summoned on demand. That is stated rather than glossed: the next
 * live occurrence is the real test of this fix, and task 85 stays open until one passes through it.
 */
const listening = new Set<http.Server>();

// Capturing the prototype method IS the monkey-patch, and `unbound-method`'s hazard does not arise:
// it is only ever re-invoked as `originalListen.apply(this, args)` below, which restores exactly the
// `this` it was taken from. The directive sits on the line it governs — `eslint-disable-next-line`
// means the *next* line, so an explanation placed between the two disables a blank.
// eslint-disable-next-line @typescript-eslint/unbound-method -- re-applied with its own `this`
const originalListen = http.Server.prototype.listen;
/**
 * The cast is not avoidable and is worth a sentence. `Server.listen` is declared with eleven
 * overloads, and `Parameters<typeof listen>` resolves to the *last* of them alone — so a rest-args
 * replacement is not assignable to the overloaded type however it is written. The behaviour is
 * still exact: whatever arguments arrive are forwarded untouched, with the original `this`.
 */
const trackedListen = function trackedListen(this: http.Server, ...args: unknown[]): http.Server {
  listening.add(this);
  this.once('close', () => listening.delete(this));
  return (originalListen as (...forwarded: unknown[]) => http.Server).apply(this, args);
} as unknown as typeof http.Server.prototype.listen;

http.Server.prototype.listen = trackedListen;

/**
 * After every file, destroy whatever its sockets left behind.
 *
 * `closeAllConnections` is Node 18.2+ and destroys the sockets the *server* holds; both ends of a
 * loopback pair live in this process, so destroying the server end makes the abandoned client socket
 * error and close. Guarded because a suite may have closed its server already, which is the ordinary
 * case — this only has work to do when something went wrong.
 */
export function closeTrackedConnections(): number {
  let closed = 0;
  for (const server of listening) {
    try {
      server.closeAllConnections();
      closed += 1;
    } catch {
      // A server already fully closed throws nothing useful, and a teardown that can fail is a
      // teardown that masks the failure it was added to prevent.
    }
  }
  listening.clear();
  return closed;
}

/** How many servers are currently tracked — exported so a spec can see the patch took effect. */
export function trackedServerCount(): number {
  return listening.size;
}

afterAll(() => {
  closeTrackedConnections();
});
