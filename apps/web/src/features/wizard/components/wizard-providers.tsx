'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

/**
 * The wizard's client-island providers (task 35.2) — TanStack Query's client, for the autosave
 * transport, and nothing else yet.
 *
 * **Scoped to the wizard rather than to the app on purpose.** `apps/web/CLAUDE.md` pins Query for
 * *client islands only* and names four consumers: the three polls and autosave. Autosave is the
 * first to exist, and it lives entirely under `(wizard)`; a provider at the `(app)` layout would put
 * the library in the bundle of every authenticated screen for a consumer none of them has. When the
 * notification unread count arrives (task 50.2) it is global and this moves up to meet it — a
 * one-line move recorded in advance rather than a second client created beside this one.
 *
 * **One client per mount, created in state.** A module-level singleton would be shared across
 * requests on the server side of a Client Component's first render; `useState`'s initializer is
 * the React idiom for a per-tree instance.
 */
export function WizardProviders({ children }: { readonly children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          // Nothing here is a query; these defaults exist so a future poll declares its own
          // interval rather than inheriting a refetch-on-focus a wizard never wants (UX-116).
          queries: { refetchOnWindowFocus: false, retry: false },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
