import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { IntlProvider } from 'use-intl';
import { routeTree } from '~/app/route-tree.gen';
import { CONSOLE_LOCALE, CONSOLE_TIME_ZONE, formats, messages } from '~/i18n';
import { RouteError, RouteNotFound } from '~/app/route-fallbacks';

/**
 * Composition root for the console: server-state client, then router. Nothing else belongs
 * here — a provider added at this level is global by definition, and this app's global surface
 * is deliberately two things.
 *
 * TanStack Query is the data layer because §11.2 settles the transport question: nothing
 * pushes. Order state, migration runs, export jobs and every exception queue poll, so
 * `refetchInterval` is the shape of every screen in `features/`. SSE and WebSockets appear
 * nowhere in §5.4, §10.4 or the edge configuration; adding one is an amendment to those
 * sections, not a ticket.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Admin reads are operator-driven and cross-tenant; a stale queue is a wrong decision,
      // not a slow one. Screens that poll set their own refetchInterval (§11.2).
      staleTime: 0,
      refetchOnWindowFocus: true,
      // The rate budget is 300 req/min per organization (§12.5.6). Unbounded retry on a
      // dense screen is how a queue view alone exhausts it.
      retry: 2,
    },
  },
});

/**
 * `context` is how a route's loader reaches the query client without importing it — the router
 * owns the dependency, not each route file. `defaultPreload: 'intent'` is safe here and is not
 * in the tenant app: preloading a tenant route can warm data the viewer may lose rights to,
 * while every admin route is already gated by the realm.
 */
const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  // A library default is user-facing text nobody here wrote. Unset, TanStack Router renders
  // its own hardcoded English "Not Found" — which the ESLint JSXText ban structurally cannot
  // catch, because the literal lives in node_modules. Both fallbacks resolve through the
  // catalogue and carry NFR-79's three parts.
  defaultNotFoundComponent: RouteNotFound,
  defaultErrorComponent: RouteError,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

/**
 * `IntlProvider` wraps the router rather than sitting inside it, because the router's own
 * fallback components render outside every route — a provider mounted per route would leave
 * `defaultNotFoundComponent` with no catalogue, which is the one screen guaranteed to need one.
 *
 * The console is Romanian-only (OQ-42), so the locale is a constant and there is no switcher
 * and no `[locale]` segment in the route tree.
 */
export function AdminProviders() {
  return (
    <IntlProvider
      locale={CONSOLE_LOCALE}
      messages={messages}
      formats={formats}
      timeZone={CONSOLE_TIME_ZONE}
    >
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </IntlProvider>
  );
}
