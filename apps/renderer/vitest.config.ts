import { defineConfig } from 'vitest/config';

/**
 * Coverage only, as every Vitest workspace's: off unless `--coverage` is passed, which only `pnpm test:coverage`
 * does, and the json-summary is what `tools/check-coverage.mjs` reads. `include` makes a source file no spec imports
 * count as uncovered — without it Vitest 4 reports only the files a test loaded.
 */
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      reporter: ['json-summary', 'text-summary'],
    },
  },
});
