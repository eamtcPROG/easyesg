import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// Vitest here, Jest in apps/api (architecture.md §12.5.6, OQ-16). One documented exception
// costs less than forcing either runner across both sides.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.spec.{ts,tsx}'],
    // Project-wide floor is 80% (§12.5.6). None of the five named components with higher
    // floors is front-end; those live in apps/api and packages/validation.
    coverage: { provider: 'v8', reportsDirectory: './coverage' },
  },
});
