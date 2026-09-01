import http from 'node:http';
import net from 'node:net';
import type { AddressInfo } from 'node:net';
import { closeTrackedConnections, trackedServerCount } from './support/close-connections';

/**
 * Proves the teardown's three claims: that the `listen` patch takes effect, that closing really
 * destroys a live socket, and that it really stops the server listening.
 *
 * **It does not prove jest exits**, which cannot be asserted from inside jest. What the node-level
 * probes established is which handles keep the loop alive; what this establishes is that this file
 * releases both of them. The join between them is reasoning, and it is written down rather than
 * implied.
 *
 * **The two assertions need two tests, and collapsing them would make one of them vacuous.** The
 * first test closes the server by hand — it has to, because that is the state task 85 diagnosed —
 * and `server.close()` sets `listening` to `false` synchronously even while it waits for an active
 * connection. So a listener assertion inside that test would pass whether or not the teardown closes
 * anything. The second test never closes the server, which is the only arrangement in which the
 * teardown is the thing under test.
 *
 * **An `.e2e-spec.ts` although it needs no database**, because it tests the e2e *harness*: the unit
 * runner's `rootDir` is `src`, and this file is `test/`'s. Naming it `.spec.ts` put it in a gap where
 * neither runner matched it — which is the shape of a test nobody notices has stopped running.
 */
describe('the e2e connection teardown (tasks 85 and 87)', () => {
  it('tracks a server that listens, and destroys the socket it holds', async () => {
    const before = trackedServerCount();
    const server = http.createServer(() => {
      // Never responds — the shape a timed-out test leaves behind.
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    expect(trackedServerCount()).toBe(before + 1);

    // **A COMPLETE request, so the connection is *active* rather than idle.** The first version of
    // this test merely connected, and it passed with the fix removed — because `server.close()` does
    // close idle connections and waits only for active ones. An idle socket is therefore not the
    // state that hangs, and asserting against it proved nothing. That is also why two attempts to
    // reproduce the hang inside a real suite exited cleanly.
    const { port } = server.address() as AddressInfo;
    const socket = net.connect(port, '127.0.0.1');
    await new Promise<void>((resolve) => socket.on('connect', () => resolve()));
    socket.write('GET / HTTP/1.1\r\nHost: localhost\r\n\r\n');
    // Let the server dispatch it to the handler that never answers.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(socket.destroyed).toBe(false);

    // **Not awaited, and that is a fact about the defect rather than a shortcut.** `server.close()`
    // does not call back while an active connection exists — it waits for one — so awaiting it here
    // deadlocks until the test times out. That is the same reason the abandoned socket keeps node's
    // loop alive, seen from the other side.
    server.close();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(socket.destroyed).toBe(false);

    expect(closeTrackedConnections()).toBeGreaterThan(0);
    await new Promise<void>((resolve) => socket.on('close', () => resolve()));
    expect(socket.destroyed).toBe(true);
  });

  /**
   * The listener half, added by task 87 after a 21-minute hang whose process still held
   * `TCP *:53897 (LISTEN)`.
   *
   * **A listening server keeps node's event loop alive entirely on its own** — no connection
   * required — so the teardown that task 85 shipped, which destroyed connections and nothing else,
   * could not release a process whose suite never reached `app.close()`. Measured: with a listening
   * server and no connections at all, `closeAllConnections()` leaves `listening === true` and the
   * process does not exit.
   *
   * Nothing here closes the server but the teardown, which is what makes the assertion bite.
   */
  it('closes the listener, on a server nothing else closed', async () => {
    const server = http.createServer(() => {});
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    expect(server.listening).toBe(true);

    expect(closeTrackedConnections()).toBeGreaterThan(0);

    expect(server.listening).toBe(false);
  });
});
