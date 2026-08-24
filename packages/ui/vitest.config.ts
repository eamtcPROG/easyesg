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
    // 15 s, matching apps/{web,admin}: the root `pnpm test` runs the workspaces in PARALLEL, and
    // under that contention a userEvent typing spec measured at 5–7 s against Vitest's 5 s
    // default. Headroom for the harness, not slack for the code.
    testTimeout: 15_000,
    include: ['src/**/*.spec.{ts,tsx}'],
    coverage: { provider: 'v8', reportsDirectory: './coverage' },
  },
});
