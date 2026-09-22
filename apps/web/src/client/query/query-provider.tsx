'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

/**
 * TanStack Query's one client for the authenticated shell (task 35.2; moved up by task 50.2.1).
 *
 * **It lived in the wizard until the unread count arrived**, because autosave was its only consumer and a
 * provider here would have put the library in every authenticated screen's bundle for a consumer none of them
 * had. The count is on every signed-in screen (UX-62), so the provider moved up to meet it, as its own docblock
 * recorded it would — one client, not a second one beside the wizard's.
 *
 * **Client islands only** (`apps/web/CLAUDE.md`): every `queryFn` points at the token-attaching pass-through, never
 * at the API's own origin, which is what keeps the access token out of browser JavaScript (AD-9, AD-12).
 *
 * **One client per mount, created in state.** A module-level singleton would be shared across requests on the
 * server side of a Client Component's first render; `useState`'s initializer is the React idiom for a per-tree
 * instance.
 */
export function QueryProvider({ children }: { readonly children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          // A poll declares its own interval rather than inheriting a refetch on every focus (UX-116), and a
          // failed poll backs off on its own schedule rather than retrying at once (`client/polling`).
          queries: { refetchOnWindowFocus: false, retry: false },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
