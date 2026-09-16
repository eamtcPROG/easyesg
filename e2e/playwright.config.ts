import { defineConfig, devices } from '@playwright/test';
import { STACK_API_BASE, STACK_ORIGIN, STACK_PORT } from './stack';

/**
 * Browser e2e for `apps/web` (task 20 — the first one). Runs against the SAME stack the api
 * e2e uses: the Compose database and Redis (`pnpm dev:up`, migrated), the api served from its
 * build output, and the web app served from its standalone bundle — the artefact the image
 * ships, not `next dev`'s approximation of it. `pree2e:web` builds all of it, so `pnpm
 * e2e:web` is runnable on its own (CLAUDE.md: a script must not depend on state a previous
 * command left behind).
 *
 * **Every server below is one this run started, on every machine** (task 102). The suite shares
 * the dev stack's ports (`stack.ts` says why), so `pree2e:web` first stops this repository's dev
 * servers (`tools/stop-dev-servers.mjs`), and `reuseExistingServer` is `false` behind it. Until task
 * 102 it was `!process.env.CI`, and Playwright adopted anything answering the address and said so
 * only under `DEBUG=pw:webserver` — so this docblock's promise held in CI and was false, silently, on
 * the machine where someone was working. **A run that fails at start with `… is already used`** is a
 * server that started between the stop and the suite; the stop script refuses a process that is not
 * this repository's rather than ending it, and says which.
 *
 * The config lives in `e2e/` rather than at the repo root so `e2e/tsconfig.json` covers it —
 * type-aware lint has no project for root-level files; the root script passes `--config`.
 *
 * Two web servers, one build: the second instance runs with `EASYESG_PSEUDOLOCALE=1`, the +40%
 * expansion harness (UX-94), because the flag is read per process — which lets the `expansion`
 * project assert layout tolerance in the same run that asserts behaviour.
 *
 * No worker is started, deliberately. The journey needs the verification token, and the token
 * is IN the outbox row the moment registration commits (P-8, OQ-54) — the worker would only
 * turn it into an email. The spec reads the row as `esg_worker`, exactly like the api e2e.
 */

/** The Compose stack's synthetic dev credentials (infra/compose/.env.example) as fallbacks,
 *  so the suite runs identically on a laptop and in CI's database job. */
const dbEnv = {
  DB_HOST: process.env.DB_HOST ?? 'localhost',
  DB_PORT: process.env.DB_PORT ?? '5432',
  DB_NAME: process.env.DB_NAME ?? 'esg',
};

/**
 * What every server entry below shares. **`reuseExistingServer: false` is also Playwright's default**,
 * so an entry added without this spread is still started rather than adopted; it is written out so
 * the choice is read here rather than inferred from a default nobody chose.
 */
const STARTED_BY_THIS_RUN = { reuseExistingServer: false, timeout: 60_000 } as const;

const webEnv = {
  NODE_ENV: 'production',
  API_BASE_URL: STACK_API_BASE,
  BILLING_ENABLED: process.env.BILLING_ENABLED ?? 'true',
  // Synthetic and e2e-only — but load-bearing since task 22: it seals the session cookie the
  // sign-in journey sets and the pass-through unseals (OQ-33).
  SESSION_SECRET: 'e2e-only-0000000000000000000000000000000000',
  /**
   * **`0.0.0.0`, matching `apps/web/Dockerfile` — and never `127.0.0.1`, which breaks the app.**
   *
   * Measured 21 Aug 2026 on one build: with `HOSTNAME=127.0.0.1` the standalone server runs the
   * proxy TWICE per request — the second pass on the already-rewritten pathname, carrying the
   * first pass's response headers as request headers — so next-intl sees a superfluous `/ro`
   * prefix, redirects to the unprefixed form, and the browser loops
   * (`ERR_TOO_MANY_REDIRECTS`). With `0.0.0.0` or unset: one pass, 200.
   *
   * It was latent until `localePrefix: 'as-needed'` (§10.8): under `'always'` an unprefixed path
   * was REDIRECTED, never rewritten, and only a rewrite re-enters. The lesson is the harness's,
   * not the app's — this suite exists to run the artefact the image ships, so it must also run
   * it the way the image runs it, and a "tidier" bind address is a difference that can decide
   * whether the product works.
   */
  HOSTNAME: '0.0.0.0',
};

export default defineConfig({
  // `.` rather than `./web` since task 23: the suite covers both browser apps, and each
  // project below scopes itself to its directory.
  testDir: '.',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  // One worker: the journey spec registers and then re-registers the same address to see the
  // 409 — ordering is part of the test.
  workers: 1,
  reporter: process.env.CI ? 'line' : [['line'], ['html', { open: 'never' }]],
  use: {
    ...devices['Desktop Chrome'],
    locale: 'ro',
  },
  projects: [
    {
      name: 'identity',
      testMatch: /web\/.*\.spec\.ts/,
      testIgnore: /expansion/,
      use: { baseURL: STACK_ORIGIN.WEB },
    },
    {
      name: 'expansion',
      // **Every `*expansion*` spec, not only `expansion.spec.ts`** (widened 29 Aug 2026, task
      // 30.2). An authenticated screen's +40% check has to run against the PADDED server, and the
      // only way to reach that server is to be in this project — a check living in the `identity`
      // project asserts no horizontal overflow with ordinary Romanian, which is not the same
      // claim and cannot fail on the thing it names. `identity`'s `testIgnore: /expansion/`
      // already keeps these files out of it, so the two sets stay disjoint by construction.
      testMatch: /web\/.*expansion.*\.spec\.ts/,
      use: { baseURL: STACK_ORIGIN.EXPANSION },
    },
    {
      name: 'admin',
      testMatch: /admin\/.*\.spec\.ts/,
      use: { baseURL: STACK_ORIGIN.CONSOLE },
    },
  ],
  webServer: [
    {
      ...STARTED_BY_THIS_RUN,
      command: 'node dist/main.js',
      cwd: '../apps/api',
      url: `${STACK_ORIGIN.API}/health`,
      // These win over `apps/api/.env`, which sets `PORT` and `PUBLIC_WEB_URL` for the dev stack:
      // `@nestjs/config` copies a file's keys into `process.env` only where they are absent.
      env: {
        ...dbEnv,
        MODE: 'http',
        PORT: String(STACK_PORT.API),
        DB_USER: process.env.DB_USER ?? 'esg_app',
        DB_PASSWORD: process.env.DB_PASSWORD ?? 'devonly-app',
        // Task 67.3 — the HTTP tier refuses to start without `esg_admin_ro`, the console's reader
        // across organizations (`admin-readonly.ts`).
        DB_ADMIN_RO_USER: process.env.DB_ADMIN_RO_USER ?? 'esg_admin_ro',
        DB_ADMIN_RO_PASSWORD: process.env.DB_ADMIN_RO_PASSWORD ?? 'devonly-admin-ro',
        REDIS_HOST: process.env.REDIS_HOST ?? 'localhost',
        REDIS_PORT: process.env.REDIS_PORT ?? '6379',
        AUTH_PASSWORD_PEPPER: process.env.AUTH_PASSWORD_PEPPER ?? 'devonly-pepper',
        // Task 23: the admin realm's secret and the console origin the api's CORS and Origin
        // proof are configured for — the admin project's preview server below.
        AUTH_ADMIN_SECRET: process.env.AUTH_ADMIN_SECRET ?? 'devonly-admin-secret',
        // Task 27.1 — the admin store opens `totp_secret` on every sign-in, and
        // `provisionOperator` seals it on the way in. Both are this one key.
        SECRET_ENCRYPTION_KEY:
          process.env.SECRET_ENCRYPTION_KEY ?? 'devonly-secret-encryption-key',
        ADMIN_ORIGIN: STACK_ORIGIN.CONSOLE,
        // Read today only by the worker's mail consumers, which this run does not start — set so
        // that a later reader in the HTTP tier cannot send a browser to a developer's server.
        PUBLIC_WEB_URL: STACK_ORIGIN.WEB,
        BILLING_ENABLED: process.env.BILLING_ENABLED ?? 'true',
      },
    },
    {
      ...STARTED_BY_THIS_RUN,
      command: 'node apps/web/.next/standalone/apps/web/server.js',
      cwd: '..',
      url: `${STACK_ORIGIN.WEB}/health`,
      // `PUBLIC_WEB_URL` is the app's own origin, which `social-flow.ts` builds its redirects and
      // its OAuth callback from. Stated rather than left to its default, which is right only
      // because this server listens on the dev port.
      env: { ...webEnv, PORT: String(STACK_PORT.WEB), PUBLIC_WEB_URL: STACK_ORIGIN.WEB },
    },
    {
      ...STARTED_BY_THIS_RUN,
      command: 'node apps/web/.next/standalone/apps/web/server.js',
      cwd: '..',
      url: `${STACK_ORIGIN.EXPANSION}/health`,
      // Its own origin, and not one the api's redirect allowlist carries — which is why no provider
      // journey runs in the `expansion` project.
      env: {
        ...webEnv,
        PORT: String(STACK_PORT.EXPANSION),
        PUBLIC_WEB_URL: STACK_ORIGIN.EXPANSION,
        EASYESG_PSEUDOLOCALE: '1',
      },
    },
    {
      ...STARTED_BY_THIS_RUN,
      // The console, served from its built bundle — `vite preview` over `dist/`, which
      // `pree2e:web` produced. Its API base URL is a BUILD input (VITE_*, one artefact per
      // environment); the default in src/lib/env.ts targets this stack's api port, which is why
      // the suite keeps the dev ports rather than building a second console for others (task 102).
      command: 'pnpm --filter @easyesg/admin start:prod',
      cwd: '..',
      url: `${STACK_ORIGIN.CONSOLE}/`,
    },
  ],
});
