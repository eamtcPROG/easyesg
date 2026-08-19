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
  resolve: { alias: { '~': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.spec.{ts,tsx}'],
    // Project-wide floor is 80% (§12.5.6). None of the five components carrying a higher floor
    // is front-end; those live in apps/api and packages/validation.
    coverage: { provider: 'v8', reportsDirectory: './coverage' },
  },
});
