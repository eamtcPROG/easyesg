import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

/**
 * §14.2's exception, here and nowhere else — task 74.4 (`architecture.md` §14.2, amended 23 Oct 2026; §12.5.6's task-74
 * row (3)). The framework may cache the public zone, by static rendering, and nothing a tenant reaches.
 *
 * **The absence is read from the build, not sampled from the server.** A page outside `(public)` that stopped reading
 * the request would be prerendered silently — no error, no warning, a `○` in a route table nobody reads — and would
 * then serve one tenant's render to the next. So the first half reads the prerender manifest of the bundle this suite
 * drives (`pree2e:web` builds and assembles it) and maps every prerendered route back to the page that rendered it:
 * every page under `[locale]` among them must be in `(public)`. A request can only ever show the pages it asks for.
 *
 * **The presence is read from the server.** The home in each locale must be in that manifest with a revalidation, and
 * the response must say the framework served it from its cache; a dynamic page beside it must say it was not.
 */
const BUNDLE = '../../apps/web/.next/standalone/apps/web/.next';

interface PrerenderManifest {
  readonly routes: Readonly<Record<string, { readonly srcRoute: string | null; readonly initialRevalidateSeconds: number | false }>>;
  readonly dynamicRoutes: Readonly<Record<string, unknown>>;
}

const read = <T>(file: string): T =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`${BUNDLE}/${file}`, import.meta.url)), 'utf8')) as T;

/**
 * Prerendered by the framework itself, outside the locale tree: its default not-found and global-error pages, which
 * `[locale]/not-found.tsx` and the locale layout supersede for every address a reader reaches, and the web manifest,
 * which holds no page at all. Anything else outside `[locale]` turning up here fails.
 */
const FRAMEWORK_OWN = ['/_not-found', '/_global-error', '/manifest.webmanifest'];

test.describe('framework caching, in the public zone and nowhere else (task 74.4)', () => {
  const prerender = read<PrerenderManifest>('prerender-manifest.json');
  // Route → the app paths that render it. Route groups vanish from the route, so one route may come from several.
  const pagesOf = new Map<string, string[]>();
  for (const [appPath, route] of Object.entries(read<Record<string, string>>('app-path-routes-manifest.json'))) {
    pagesOf.set(route, [...(pagesOf.get(route) ?? []), appPath]);
  }

  test('no page outside (public) is prerendered, nor any route outside the locale tree but the framework’s own', () => {
    const prerendered = [
      ...Object.values(prerender.routes).map((entry) => entry.srcRoute),
      ...Object.keys(prerender.dynamicRoutes),
    ].filter((route): route is string => route !== null);

    for (const route of new Set(prerendered)) {
      if (!route.startsWith('/[locale]')) {
        expect(FRAMEWORK_OWN, `${route} is prerendered outside the locale tree`).toContain(route);
        continue;
      }
      const pages = pagesOf.get(route) ?? [];
      expect(pages, `${route} maps to no page`).not.toHaveLength(0);
      for (const page of pages) expect(page, `${page} is prerendered`).toMatch(/^\/\[locale\]\/\(public\)\//);
    }
  });

  test('the home is prerendered in every locale, and revalidated', () => {
    for (const locale of ['/ro', '/en', '/ru']) {
      const entry = prerender.routes[locale];
      expect(entry, `${locale} is not prerendered`).toBeDefined();
      expect(pagesOf.get(entry.srcRoute ?? '')).toEqual(['/[locale]/(public)/page']);
      expect(entry.initialRevalidateSeconds, `${locale} is cached for good`).toBeGreaterThan(0);
    }
  });

  test('the server answers the home from its cache, and a dynamic page beside it from no cache', async ({ request }) => {
    for (const pathname of ['/', '/en', '/ru']) {
      const response = await request.get(pathname);
      expect(response.status(), pathname).toBe(200);
      expect(response.headers()['x-nextjs-cache'], `${pathname} from the framework's cache`).toMatch(/^(HIT|STALE)$/);
    }
    for (const pathname of ['/sign-in', '/en/legal/terms']) {
      const response = await request.get(pathname);
      expect(response.headers()['x-nextjs-cache'], pathname).toBeUndefined();
      expect(response.headers()['cache-control'], pathname).toContain('no-store');
    }
  });
});
