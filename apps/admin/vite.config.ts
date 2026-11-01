import { fileURLToPath } from 'node:url';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * Admin console build (architecture.md AD-9, §12.1).
 *
 * A static bundle served by `edge` on `admin.<host>` (§5.4, §10.4) — there is no server tier
 * here, which is the whole reason AD-12 exists. Nothing in this file may grow one.
 *
 * `tanstackRouter` runs BEFORE `react`: it generates `src/app/route-tree.gen.ts` from
 * `src/app/routes/`, and the React transform has to see the generated file, not the stub.
 *
 * There is deliberately NO `server.proxy`. Production is cross-origin — `admin.<host>` calling
 * `api.<host>` — and a dev proxy would make development same-origin, hiding the CSRF/SameSite
 * question (architecture.md OQ-33) until staging. OQ-33 says the answer is "needed before the
 * first authenticated write ships"; a proxy here is how that deadline gets missed quietly.
 */
export default defineConfig({
  plugins: [
    tanstackRouter({
      target: 'react',
      routesDirectory: './src/app/routes',
      generatedRouteTree: './src/app/route-tree.gen.ts',
      quoteStyle: 'single',
      semicolons: true,
      autoCodeSplitting: true,
    }),
    react(),
  ],
  // `~`, not `@`. tsconfig.boundaries.json maps `@/*` to apps/web/src, and a TS `paths` key holds
  // one meaning — sharing it would resolve admin's `~/lib/env` to web's `lib/env` (both exist)
  // and make the cross-app boundary rules fire on the wrong file. See that file's comment.
  resolve: { alias: { '~': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { port: 3200 },
  preview: { port: 3200 },
  build: { outDir: 'dist', sourcemap: true },
});
