import http from 'node:http';
import net from 'node:net';
import type { AddressInfo } from 'node:net';
import { closeTrackedConnections, trackedServerCount } from './support/close-connections';

/**
 * Proves the teardown's two halves: that the `listen` patch takes effect, and that closing really
 * destroys a live socket.
 *
 * **It does not prove jest exits**, which cannot be asserted from inside jest. What the node-level
 * probes established is that an undestroyed socket is what keeps the loop alive; what this
 * establishes is that this file destroys it. The join between them is reasoning, and it is written
 * down rather than implied.
 *
 * **An `.e2e-spec.ts` although it needs no database**, because it tests the e2e *harness*: the unit
 * runner's `rootDir` is `src`, and this file is `test/`'s. Naming it `.spec.ts` put it in a gap where
 * neither runner matched it — which is the shape of a test nobody notices has stopped running.
 */
describe('the e2e connection teardown (task 85, partial)', () => {
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

    server.close();
    // `server.close()` alone leaves an ACTIVE connection alive — which is the entire defect.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(socket.destroyed).toBe(false);

    expect(closeTrackedConnections()).toBeGreaterThan(0);
    await new Promise<void>((resolve) => socket.on('close', () => resolve()));
    expect(socket.destroyed).toBe(true);
  });
});
