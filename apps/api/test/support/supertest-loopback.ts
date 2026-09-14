import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * Makes supertest's per-request server listen on `127.0.0.1` — the address supertest sends to.
 *
 * ## The defect
 *
 * supertest's `Test#serverAddress` calls `app.listen(0)` **with no host** for every request made against a
 * server that is not already listening — and every suite here passes `app.getHttpServer()` unlistened —
 * then requests `http://127.0.0.1:<port>`. A host-less listen binds the IPv6 wildcard, `::`. On macOS a
 * wildcard binding does not stop another process binding the same port on `127.0.0.1` specifically, and
 * the kernel delivers `127.0.0.1:<port>` to the more specific binding. So a local tool that binds that port
 * while the request is in flight receives the request, and its answer is what the test reads.
 *
 * **Measured, not reasoned** (`docs/build-log.md`, 14 Sep 2026). With our server on `::`, another
 * process's explicit `127.0.0.1` bind of the same port succeeds and answers our request; with ours on
 * `127.0.0.1` that bind is refused with `EADDRINUSE`, and a foreign wildcard or `0.0.0.0` bind leaves ours
 * answering. **Seen live**: in a full run, a `POST …/auth/admin/session/recovery` answered `400 WebSockets
 * request was expected` and a `GET …/auth/admin/session` an empty `404`, neither reaching this api — from
 * two ports VS Code's `Code Helper (Plugin)` was still holding afterwards.
 *
 * ## Why supertest is patched, rather than `http.Server#listen`
 *
 * **The first build defaulted the host inside `listen`, and it crashed every request.** A `listen` that
 * names a host binds only after a DNS lookup — even for an IP literal — so `address()` is `null` on the
 * next line, which is exactly where supertest reads the port. The listen therefore has to be allowed to
 * finish before the request is sent, and only supertest's own `end` is in a position to wait:
 * `serverAddress` starts the listen, and `end` sends once the server is listening, with the real port.
 *
 * A server a suite already listens on keeps supertest's own path untouched — supertest neither listens
 * nor closes what it did not open. It patches the test process only: `main.http.ts` still listens on every
 * interface.
 *
 * **Central rather than per suite** (project owner, 14 Sep 2026). Each suite listening explicitly would
 * work, and the next suite to omit it would bring the failure back with nothing to say why —
 * `close-connections.ts`'s reason for patching the test process rather than trusting every suite to
 * remember. The listen still passes through that file's tracking, so its teardown covers these servers.
 * **It reaches into supertest's private methods** (7.2.2), which a version change can move;
 * `supertest-loopback.e2e-spec.ts` pins the bound address and fails if the patch stops taking effect.
 */
const LOOPBACK = '127.0.0.1';

interface SupertestTest {
  url: string;
  _server?: Server;
  serverAddress(app: Server, path: string): string;
  end(fn?: (error: unknown, response?: unknown) => void): SupertestTest;
}

// supertest's `Test` class is not part of its public entry point, so it is reached by path.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- a private module, reached by path
const Test = require('supertest/lib/test') as { prototype: SupertestTest };

/** The path each request will be sent to once the listener supertest started for it is up. */
const pendingPath = new WeakMap<SupertestTest, string>();

// eslint-disable-next-line @typescript-eslint/unbound-method -- re-applied with its own `this`
const originalServerAddress = Test.prototype.serverAddress;
// eslint-disable-next-line @typescript-eslint/unbound-method -- re-applied with its own `this`
const originalEnd = Test.prototype.end;

Test.prototype.serverAddress = function serverAddress(this: SupertestTest, app: Server, path: string): string {
  // A suite's own listener: supertest's answer stands, and it will not close what it did not open.
  if (app.address()) return originalServerAddress.call(this, app, path);

  this._server = app.listen(0, LOOPBACK);
  pendingPath.set(this, path);
  // A placeholder: the port is unknown until the lookup a named host requires has run. `end` replaces it.
  return `http://${LOOPBACK}:0${path}`;
};

Test.prototype.end = function end(this: SupertestTest, fn) {
  const server = this._server;
  const path = pendingPath.get(this);
  if (server === undefined || path === undefined) return originalEnd.call(this, fn);
  pendingPath.delete(this);

  const send = (): void => {
    this.url = `http://${LOOPBACK}:${(server.address() as AddressInfo).port}${path}`;
    originalEnd.call(this, fn);
  };
  if (server.listening) send();
  else server.once('listening', send);
  return this;
};
