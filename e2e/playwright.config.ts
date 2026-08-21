import { defineConfig, devices } from '@playwright/test';

/**
 * Browser e2e for `apps/web` (task 20 — the first one). Runs against the SAME stack the api
 * e2e uses: the Compose database and Redis (`pnpm dev:up`, migrated), the api served from its
 * build output, and the web app served from its standalone bundle — the artefact the image
 * ships, not `next dev`'s approximation of it. `pree2e:web` builds all of it, so `pnpm
 * e2e:web` is runnable on its own (CLAUDE.md: a script must not depend on state a previous
 * command left behind).
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
const API_PORT = 3000;
const WEB_PORT = 3100;
const EXPANSION_PORT = 3101;
// The console's dev port, which is also what the api's ADMIN_ORIGIN defaults to — served here
// from `vite preview` over `dist/`, the artefact the image ships (task 23).
const ADMIN_PORT = 3200;

/** The Compose stack's synthetic dev credentials (infra/compose/.env.example) as fallbacks,
 *  so the suite runs identically on a laptop and in CI's database job. */
const dbEnv = {
  DB_HOST: process.env.DB_HOST ?? 'localhost',
  DB_PORT: process.env.DB_PORT ?? '5432',
  DB_NAME: process.env.DB_NAME ?? 'esg',
};

const webEnv = {
  NODE_ENV: 'production',
  API_BASE_URL: `http://localhost:${API_PORT}/api/v1`,
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
      use: { baseURL: `http://localhost:${WEB_PORT}` },
    },
    {
      name: 'expansion',
      testMatch: /web\/expansion.*\.spec\.ts/,
      use: { baseURL: `http://localhost:${EXPANSION_PORT}` },
    },
    {
      name: 'admin',
      testMatch: /admin\/.*\.spec\.ts/,
      use: { baseURL: `http://localhost:${ADMIN_PORT}` },
    },
  ],
  webServer: [
    {
      command: 'node dist/main.js',
      cwd: '../apps/api',
      url: `http://localhost:${API_PORT}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        ...dbEnv,
        MODE: 'http',
        PORT: String(API_PORT),
        DB_USER: process.env.DB_USER ?? 'esg_app',
        DB_PASSWORD: process.env.DB_PASSWORD ?? 'devonly-app',
        REDIS_HOST: process.env.REDIS_HOST ?? 'localhost',
        REDIS_PORT: process.env.REDIS_PORT ?? '6379',
        AUTH_PASSWORD_PEPPER: process.env.AUTH_PASSWORD_PEPPER ?? 'devonly-pepper',
        // Task 23: the admin realm's secret and the console origin the api's CORS and Origin
        // proof are configured for — the admin project's preview server below.
        AUTH_ADMIN_SECRET: process.env.AUTH_ADMIN_SECRET ?? 'devonly-admin-secret',
        ADMIN_ORIGIN: `http://localhost:${ADMIN_PORT}`,
        BILLING_ENABLED: process.env.BILLING_ENABLED ?? 'true',
      },
    },
    {
      command: 'node apps/web/.next/standalone/apps/web/server.js',
      cwd: '..',
      url: `http://localhost:${WEB_PORT}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: { ...webEnv, PORT: String(WEB_PORT) },
    },
    {
      command: 'node apps/web/.next/standalone/apps/web/server.js',
      cwd: '..',
      url: `http://localhost:${EXPANSION_PORT}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        ...webEnv,
        PORT: String(EXPANSION_PORT),
        EASYESG_PSEUDOLOCALE: '1',
      },
    },
    {
      // The console, served from its built bundle — `vite preview` over `dist/`, which
      // `pree2e:web` produced. Its API base URL is a BUILD input (VITE_*, one artefact per
      // environment); the default in src/lib/env.ts targets this stack's api port.
      command: 'pnpm --filter @easyesg/admin start:prod',
      cwd: '..',
      url: `http://localhost:${ADMIN_PORT}/`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
