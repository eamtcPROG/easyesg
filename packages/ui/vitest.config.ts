import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * The design system's first test harness, added with `src/forms/` (24 Aug 2026). Until then this
 * package's `test` script was `--passWithNoTests` and there was nothing to run: the presentational
 * components are rendered as specimens in `design/screens/`, and their contract is visual.
 * `src/forms/` is different — it carries behaviour (the id scope, the error walk, the controlled
 * value) that both front ends depend on and neither can see.
 *
 * Vite compiles the CSS modules the components import, so no mock is needed for them.
 */
export default defineConfig({
  plugins: [react()],
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
    coverage: { provider: 'v8', reportsDirectory: './coverage' },
  },
});
