import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// Vitest here, Jest in apps/api (architecture.md §12.5.6, OQ-16). One documented exception
// costs less than forcing either runner across both sides.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    // `@easyesg/i18n` builds to dist/ for Node (architecture.md OQ-47), so its `exports` map
      // sends every non-opted-in consumer there. Tests point back at source so `pnpm test` works
      // on a fresh clone with no prior build — the package's `source` condition expresses the same
      // intent, but Vite 6+ REPLACES the default conditions rather than extending them, and an
      // alias states it without that trap.
      '@easyesg/i18n': fileURLToPath(new URL('../../packages/i18n/src/index.ts', import.meta.url)),
      // Same reasoning: @easyesg/validation dual-builds for Node consumers (OQ-47), and the
      // alias keeps `pnpm test` working on a fresh clone with no prior build.
      '@easyesg/validation': fileURLToPath(
        new URL('../../packages/validation/src/index.ts', import.meta.url),
      ),
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
    server: {
      deps: {
        // `next-intl/middleware` is the one dependency a spec loads for real rather than mocking:
        // `proxy.spec.ts` tests the COMPOSITION of locale routing with session rotation, and a
        // stand-in would pin that ordering against a fiction. Left external, Node's own ESM
        // resolver handles next-intl's `import 'next/server'` — and `next` ships no `exports` map
        // and is not `type: module`, so bare-subpath resolution fails with "did you mean
        // next/server.js". Inlining hands it to Vite, which resolves the extension.
        inline: ['next-intl'],
      },
    },
    // Project-wide floor is 80% (§12.5.6). None of the five named components with higher
    // floors is front-end; those live in apps/api and packages/validation.
    coverage: { provider: 'v8', reportsDirectory: './coverage' },
  },
});
