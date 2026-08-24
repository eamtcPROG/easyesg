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
    // 15 s, not Vitest's 5 s default: the root `pnpm test` runs three workspaces' suites in
    // PARALLEL, and under that contention a userEvent typing spec that takes 1 s alone has
    // been measured at 5–7 s — ten timeouts in one gates run (24 Aug 2026), all green in
    // isolation. The value buys headroom for the harness, not slack for the code: a genuine
    // hang still fails, three times slower.
    testTimeout: 15_000,
    include: ['src/**/*.spec.{ts,tsx}'],
    // Project-wide floor is 80% (§12.5.6). None of the five components carrying a higher floor
    // is front-end; those live in apps/api and packages/validation.
    coverage: { provider: 'v8', reportsDirectory: './coverage' },
  },
});
