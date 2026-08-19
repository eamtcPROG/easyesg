import type { QueryClient } from '@tanstack/react-query';
import { Outlet, createRootRouteWithContext } from '@tanstack/react-router';

/**
 * Root route. Establishes the router context and nothing else.
 *
 * There is no locale segment in this tree, and that is a decision rather than an omission. The
 * administrative console is Romanian-only at MVP: NFR-23 and FR-63 set three live locales for the
 * tenant interface, exports and email, while `actors.md` frames the three as PA's content-authoring
 * scope and `design_spec.md` §3.2's admin row carries no locale column. Authoring the console
 * chrome three times for a handful of internal operators buys nothing, and FR-63's "no
 * architectural limit" is preserved by the fact that every string here is still a message key
 * resolved from the configuration store — adding a locale stays a data change, not a rebuild of
 * this route tree. Recorded in architecture.md §18.
 *
 * The router context carries the query client so a route loader reaches it without importing it,
 * which is what keeps `app/` from becoming a second composition root.
 */
export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootRoute,
});

function RootRoute() {
  return <Outlet />;
}
