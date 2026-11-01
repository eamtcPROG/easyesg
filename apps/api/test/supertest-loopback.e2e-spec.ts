import http from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';

/**
 * Proves `support/supertest-loopback.ts`: supertest's per-request server listens on `127.0.0.1`, and a port
 * held that way cannot be taken by another listener on `127.0.0.1` — the displacement that let local tools
 * answer e2e requests (14 Sep 2026).
 *
 * **Each test is shaped like the defect, not like the fix.** The requests go through supertest against an
 * unlistened server, which is how every suite calls it; the intruder binds while the request is in flight,
 * which is when a local tool took the port. With the patch removed the first two fail — the address is `::`,
 * and the intruder's bind succeeds — and the third keeps passing, because it is the path the patch must not
 * touch.
 *
 * **An `.e2e-spec.ts` although it needs no database**, for `close-connections.e2e-spec.ts`'s reason: it
 * tests the e2e harness, and only this runner loads the setup file under test.
 */
describe('supertest’s server listens on the address it requests (14 Sep 2026)', () => {
  it('binds the per-request server to 127.0.0.1', async () => {
    let bound: AddressInfo | undefined;
    const server = http.createServer((_req, res) => {
      bound = server.address() as AddressInfo;
      res.end('ours');
    });

    await request(server).get('/').expect(200, 'ours');

    expect(bound).toMatchObject({ address: '127.0.0.1' });
  });

  it('keeps its port against a listener that binds it on 127.0.0.1 while the request is in flight', async () => {
    let intrusion = 'not attempted';
    const intruder = http.createServer((_req, res) => {
      res.statusCode = 418;
      res.end('foreign');
    });
    const server = http.createServer((_req, res) => {
      const { port } = server.address() as AddressInfo;
      intruder.once('error', (error: NodeJS.ErrnoException) => {
        intrusion = error.code ?? error.message;
        res.end('ours');
      });
      intruder.listen(port, '127.0.0.1', () => {
        intrusion = 'bound';
        res.end('ours');
      });
    });

    try {
      await request(server).get('/').expect(200, 'ours');
      expect(intrusion).toBe('EADDRINUSE');
    } finally {
      intruder.close();
    }
  });

  it('leaves a server the suite already listens on to supertest’s own path, and open', async () => {
    const server = http.createServer((_req, res) => res.end('ours'));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

    try {
      await request(server).get('/').expect(200, 'ours');
      expect(server.listening).toBe(true);
    } finally {
      server.close();
    }
  });
});
