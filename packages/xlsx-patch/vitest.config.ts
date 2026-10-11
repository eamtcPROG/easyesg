import { defineConfig } from 'vitest/config';

/**
 * Coverage only, as `packages/validation`'s: off unless `--coverage` is passed, which only `pnpm test:coverage` does,
 * and the json-summary is what `tools/check-coverage.mjs` reads. `include` makes a source file no spec imports count
 * as uncovered.
 *
 * **The suites read the committed EFRAG binaries** in `config/efrag/`, a few hundred kilobytes each, so a spec that
 * opens all three takes longer than Vitest's default 5 s on a loaded host; 15 s is the ceiling `apps/web` and
 * `packages/ui` already carry for the same host.
 */
export default defineConfig({
  test: {
    testTimeout: 15_000,
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/testing/**'],
      reporter: ['json-summary', 'text-summary'],
    },
  },
});
