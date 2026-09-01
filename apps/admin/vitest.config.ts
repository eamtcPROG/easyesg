import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * Standalone rather than `mergeConfig(viteConfig, …)`, and deliberately so: merging would pull in
 * `tanstackRouter`, whose generator writes `src/app/route-tree.gen.ts` — a test run must not
 * rewrite committed source. The cost is four duplicated lines; the alternative is a test suite
 * with a side effect on the working tree.
 *
 * Vitest here and in apps/web, Jest in apps/api (architecture.md §12.5.6, OQ-16).
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./src', import.meta.url)),
    // `@easyesg/i18n` builds to dist/ for Node (architecture.md OQ-47), so its `exports` map
      // sends every non-opted-in consumer there. Tests point back at source so `pnpm test` works
      // on a fresh clone with no prior build — the package's `source` condition expresses the same
      // intent, but Vite 6+ REPLACES the default conditions rather than extending them, and an
      // alias states it without that trap.
      '@easyesg/i18n': fileURLToPath(new URL('../../packages/i18n/src/index.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // 30 s, not Vitest's 5 s default and not the 15 s this carried until 1 Sep 2026. **The cause
    // is the development host's MEMORY, not parallel workspaces as the comment here used to say**
    // — architecture.md §12.5.6 holds the decision and apps/api/test/README.md the measurements.
    //
    // The primary fix is not this number: it is the root `test` script's
    // `--workspace-concurrency=1`, which removes the memory multiplier and takes the slowest of the
    // three jsdom suites' 276 tests from 4 998 ms back to 1 425 ms — while finishing the gate 11 s
    // FASTER, because on a host short of memory rather than of CPU, running fewer things at once
    // finishes sooner. This ceiling is the margin for the machine states that survive that, and it
    // matches `jest-e2e.json` so the host carries one ceiling rather than two. Headroom for the
    // harness, not slack for the code: a genuine hang still fails.
    testTimeout: 30_000,
    include: ['src/**/*.spec.{ts,tsx}'],
    // Project-wide floor is 80% (§12.5.6). None of the five components carrying a higher floor
    // is front-end; those live in apps/api and packages/validation.
    coverage: { provider: 'v8', reportsDirectory: './coverage' },
  },
});
