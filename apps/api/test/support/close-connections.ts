import http from 'node:http';

/**
 * Releases the handles an abandoned e2e request leaves behind, so jest can exit (tasks 85 and 87).
 *
 * ## What this fixes, and what it does not
 *
 * It fixes the **hang**, never the thing that caused it. Task 85 collected eight instances in which an
 * e2e run failed, and two things were tangled in that row: a test exceeding jest's 5 000 ms limit, and
 * jest then never exiting. This file is the second only. The first is closed separately and was the
 * host's memory rather than anything in the code — `architecture.md` §12.5.6 and `test/README.md`.
 *
 * Caught live on 1 Sep 2026, mid-hang: one test in `invitations.e2e-spec.ts` timed out, 750 of 751
 * passed, and the process then sat **19 minutes at 0.0 % CPU** holding **no database connection** and
 * exactly **one** socket — `TCP localhost:53898->localhost:53897`, a loopback pair. That is
 * supertest's client connection to the in-process server. Only the client end survived, because
 * `app.close()` closed the server and nothing closed the request the timed-out test had abandoned.
 * One referenced handle keeps node's event loop alive, and that is the whole of the non-exit.
 *
 * What this buys is cost, not correctness: a one-test flake now fails in seconds instead of stalling a
 * gate run for as long as nobody is watching it.
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
 * The **mechanism** is proven deterministically at the node level, and the table on
 * `closeTrackedConnections` below is that proof: an abandoned request with `agent: false` keeps the
 * loop alive; `globalAgent.destroy()` does not help; and **neither `closeAllConnections()` nor
 * `close()` alone releases it** — one leaves the listener, the other leaves the connection.
 * `close-connections.e2e-spec.ts` proves the wiring, asserting both halves, and each assertion has
 * been seeded to confirm it fails when its half is removed.
 *
 * **Task 85 shipped only the first half, and a live hang found the second** (task 87). That instance
 * had `app.close()` already run, so its process held no listener and exactly one orphaned client —
 * which made destroying connections look like the whole answer. The hang on 1 Sep 2026 at 18:01 had
 * the opposite shape: server still listening, six connections, a live database session, 21 minutes at
 * 0 % CPU. Both are now covered.
 *
 * **What is still not proven is either fix in situ**, because a hang arrives on timing nobody can
 * summon. The next live occurrence remains the real test.
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
  // **Registered once per server, not once per `listen` call.** supertest calls `listen` for every
  // request, so the first version of this added a `close` listener each time and node started
  // reporting `MaxListenersExceededWarning: 11 close listeners added to [Server]` across the suite
  // — a listener leak introduced by the very file meant to stop a leak. `Set.add` was already
  // idempotent; the listener was not.
  // Tracked until the teardown clears it, rather than until the server closes. The earlier version
  // untracked on `close`, which is strictly worse for no benefit — `closeAllConnections()` on an
  // already-closed server is harmless, and the set is cleared per file so it cannot grow. It also
  // removes one ordering question from a file whose whole subject is ordering.
  listening.add(this);
  return (originalListen as (...forwarded: unknown[]) => http.Server).apply(this, args);
} as unknown as typeof http.Server.prototype.listen;

http.Server.prototype.listen = trackedListen;

/**
 * After every file, release whatever it left holding node's event loop — **both the connections and
 * the listener**, because neither alone is enough.
 *
 * `closeAllConnections()` (Node 18.2+) destroys the sockets the *server* holds; both ends of a
 * loopback pair live in this process, so destroying the server end makes an abandoned client socket
 * error and close. `close()` stops the server listening. **A listening server is a ref'd handle and
 * keeps the loop alive entirely on its own**, which is the gap this file shipped with under task 85
 * and task 87 closed — after a 21-minute hang whose process still held `TCP *:53897 (LISTEN)`, six
 * client connections and an idle database session.
 *
 * Measured rather than reasoned (1 Sep 2026), each row a process that either exits or does not:
 *
 * | teardown | `server.listening` after | loop released |
 * | --- | --- | --- |
 * | `closeAllConnections()` alone, no connections | `true` | **no** — the listener holds it |
 * | `closeAllConnections()` alone, one live connection | `true` | **no** |
 * | `close()` alone, one live connection | `false` | **no** — the connection holds it |
 * | **both, in this order** | `false` | **yes, the process exits** |
 *
 * Task 85 measured only the third state it could see: its hang had the server *already closed* by
 * `app.close()`, so destroying the orphaned client was the whole remedy there. It is not the whole
 * remedy when `app.close()` never ran.
 *
 * **The order is not a preference.** `close()` does not call back while an active connection exists,
 * so destroying the connections first leaves it nothing to wait for.
 *
 * **`close()` takes no callback, deliberately.** Node delivers `ERR_SERVER_NOT_RUNNING` *only* to a
 * callback; a bare `close()` on an already-closed or never-listened server returns silently and
 * emits no `error` event (measured both ways). Passing one would manufacture the very failure the
 * `catch` exists to absorb — and the ordinary case here is a server a suite already closed.
 */
export function closeTrackedConnections(): number {
  let closed = 0;
  for (const server of listening) {
    try {
      server.closeAllConnections();
      server.close();
      closed += 1;
    } catch {
      // A teardown that can fail is a teardown that masks the failure it was added to prevent.
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
