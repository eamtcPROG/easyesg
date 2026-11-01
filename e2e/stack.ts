/**
 * Where the browser suite's stack listens (task 102; `architecture.md` §12.5.6's task-102 row) — read by
 * `playwright.config.ts` to start it, by every spec that names an origin other than its own project's
 * `baseURL`, and by `tools/stop-dev-servers.mjs`, which clears these ports before a run.
 *
 * **The dev stack's ports, on purpose.** The console's api address is inlined when it is built, so a
 * suite on ports of its own would need a second, differently configured console build — and what the
 * suite tests should be the build that ships, differing only in its environment. So the suite shares
 * the ports and the build, and the developer's servers are stopped before it starts rather than
 * adopted, which is what Playwright did until task 102 and said only under `DEBUG=pw:webserver`.
 *
 * **One place, because the ports were written in four**: the config held them, and three specs
 * restated the api's and the web app's origins as literals.
 */
export const STACK_PORT = {
  API: 3000,
  /**
   * The api again, with the +40% expansion harness on (task 51.3) — the flag is read per process, and
   * one api serves all three projects, so padding *this* one is what keeps `identity` and `admin`
   * asserting against real words while the expansion project reads padded ones.
   */
  EXPANSION_API: 3001,
  WEB: 3100,
  /** The web app again, with the +40% expansion harness on (UX-94) — the flag is read per process. */
  EXPANSION: 3101,
  CONSOLE: 3200,
} as const;

const originOf = (port: number): string => `http://localhost:${port}`;

export const STACK_ORIGIN = {
  API: originOf(STACK_PORT.API),
  EXPANSION_API: originOf(STACK_PORT.EXPANSION_API),
  WEB: originOf(STACK_PORT.WEB),
  EXPANSION: originOf(STACK_PORT.EXPANSION),
  CONSOLE: originOf(STACK_PORT.CONSOLE),
} as const;

/** The public API's base, as both front ends are configured with it. */
export const STACK_API_BASE = `${STACK_ORIGIN.API}/api/v1`;

/**
 * The padded api's base, which only the expansion web server is pointed at (task 51.3). The console's
 * is inlined at build time and the tenant app's is an environment value, which is what makes a second
 * api reachable by one of them and not the others.
 */
export const STACK_EXPANSION_API_BASE = `${STACK_ORIGIN.EXPANSION_API}/api/v1`;
