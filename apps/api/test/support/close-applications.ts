import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { closeTrackedConnections } from './close-connections';

/**
 * Closes every Nest application a test file created and did not close, so a failed setup cannot hold jest open
 * (task 178). The sibling of `close-connections.ts`, which releases the HTTP servers an abandoned request leaves; this
 * releases what only `app.close()` can — the application's database pools and Redis clients.
 *
 * ## The hang this is for, measured
 *
 * Task 177's run (29 Sep 2026) finished at 1,442 passed and 15 failed, two suites whose `beforeAll` timed out, and then
 * sat twenty minutes without exiting. **The timeouts were a stalled process, not a lock**: the test Postgres logged four
 * `canceling authentication due to timeout` from the run's own connections inside the window, and authentication
 * precedes every query — task 85's diagnosis of this host's memory, again. What this file answers is the hang after it.
 *
 * Two throwaway probes reproduced it, each a process that did not exit:
 *
 * | shape | what held the loop |
 * | --- | --- |
 * | the setup times out after booting the app, and the teardown never reaches `app.close()` | one socket to the test Postgres and two to its Redis — the application's pool and clients |
 * | the setup times out **while the app is still booting**, so it finishes after the file has ended | the same, plus the `require … after the Jest environment has been torn down` error the real run logged |
 *
 * The second is the real run's signature, which is why both halves below exist: closing what is open when the file ends
 * would miss an application that had not finished booting yet.
 *
 * ## Why this, and not the three alternatives
 *
 * - **`unref()` the configuration store's poll timer** — it already is (`configuration-store.service.ts`), and the probes
 *   show why that is not enough: the timer fires on only because the sockets above keep the loop alive.
 * - **Each suite closing its app first, or in a `finally`** — sixty suites, a forgetting mode per suite, and a teardown
 *   stalled on its first statement still never reaches the close. The owner chose tracking over per-suite options for
 *   the servers on 1 Sep 2026 for exactly that reason (`close-connections.ts`).
 * - **`--forceExit`** — exits whatever holds the loop, which is the problem with it: a real leak in the application's own
 *   shutdown — a timer `onApplicationShutdown` forgot to clear — would be as invisible as this one. This closes what a
 *   test file created, by the same `app.close()` production runs, so a leak in that path still holds jest open and is
 *   still found.
 *
 * ## How
 *
 * It wraps `NestFactory.create` and `NestFactory.createApplicationContext` for the test process — the same kind of patch
 * `close-connections.ts` makes to `http.Server.prototype.listen`, confined to `test/support` — so no suite can forget to
 * register. Each application's `close` is wrapped to untrack it and to be idempotent, since a teardown that resumes after
 * this one has closed its application calls `close` a second time.
 */
const open = new Set<INestApplicationContext>();

/** Set when the file's teardown has run: an application that finishes booting after it is closed on arrival. */
let fileEnded = false;

/** How long the teardown waits on one application's `close` — a stalled shutdown must not stall the teardown too. */
const CLOSE_WAIT_MS = 10_000;

const settleWithin = (work: Promise<unknown>, milliseconds: number): Promise<void> =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, milliseconds);
    timer.unref();
    work.then(
      () => resolve(),
      () => resolve(),
    );
  });

/**
 * **Defined, never assigned, and that is Nest's proxy rather than a style.** `NestFactory` returns the application
 * wrapped in a `Proxy` whose `set` trap answers without assigning, so `app.close = …` is silently ignored — the first
 * version of this file did exactly that, and its spec caught it. `defineProperty` has no trap there and reaches the
 * application itself. The original is the prototype's `close`, called on the proxy as Nest's own calls are: read
 * through the proxy instead, it would be Nest's exception wrapper around the property this defines — a recursion.
 */
const track = <T extends INestApplicationContext>(app: T): T => {
  const originalClose = (Object.getPrototypeOf(app) as { readonly close: (this: T) => Promise<void> }).close;
  let closing: Promise<void> | undefined;
  Object.defineProperty(app, 'close', {
    configurable: true,
    writable: true,
    value: (): Promise<void> => {
      open.delete(app);
      closing ??= originalClose.call(app);
      return closing;
    },
  });
  if (fileEnded) {
    // Booted after the file ended: nothing will ever close it but this.
    void app.close().catch(() => undefined);
  } else {
    open.add(app);
  }
  return app;
};

const originalCreate = NestFactory.create.bind(NestFactory);
const originalCreateContext = NestFactory.createApplicationContext.bind(NestFactory);

// The casts are the overloads' price, as in `close-connections.ts`: `create` is declared with overloads that a
// forwarding function cannot be assigned to whatever it is written as. The arguments reach the original untouched.
NestFactory.create = (async (...args: Parameters<typeof originalCreate>) =>
  track(await originalCreate(...args))) as typeof NestFactory.create;
NestFactory.createApplicationContext = (async (...args: Parameters<typeof originalCreateContext>) =>
  track(await originalCreateContext(...args))) as typeof NestFactory.createApplicationContext;

/**
 * Closes every application still open, **after releasing the HTTP servers** — Nest's express adapter waits in `close`
 * for every active connection to end, so an abandoned request would otherwise hold this teardown exactly as it held the
 * run. Each close is bounded, and the count of what was still open is returned for the spec.
 */
export async function closeTrackedApplications(): Promise<number> {
  fileEnded = true;
  closeTrackedConnections();
  const left = [...open];
  await Promise.all(left.map((app) => settleWithin(app.close(), CLOSE_WAIT_MS)));
  return left.length;
}

/** How many applications are open and tracked — exported so a spec can see the patch took effect. */
export function trackedApplicationCount(): number {
  return open.size;
}

afterAll(closeTrackedApplications, CLOSE_WAIT_MS + 5_000);
