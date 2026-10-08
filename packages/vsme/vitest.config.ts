import { defineConfig } from 'vitest/config';

/**
 * Coverage only (task 205): this package ran on Vitest's defaults until NFR-88's gate needed it
 * measured. Off unless `--coverage` is passed, which only `pnpm test:coverage` does; the
 * json-summary is what `tools/check-coverage.mjs` reads. `include` is what makes a source file no
 * spec imports count as uncovered — without it Vitest 4 reports only the files a test loaded.
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
