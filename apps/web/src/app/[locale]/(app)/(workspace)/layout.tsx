import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import type { ReactNode } from 'react';
import { WorkspaceNavigation } from '@/shared/workspace-navigation';

/**
 * Screens that carry the **workspace** navigation tier (§4.2): Reports, Entities & periods,
 * Organization, Users & access, Plan & billing.
 *
 * This route group exists to express UX-5. The wizard suppresses this tier and replaces it with
 * the module list, so the wizard cannot nest inside this layout - it is a sibling group,
 * `(wizard)`, over the same URL space. Route groups add no path segment, which is what lets
 * `/reports` and `/reports/:id/:module` sit under different layout ancestries without either
 * one knowing about the other.
 *
 * **The client provider is namespace-scoped**, exactly as `(identity)`'s is and for the same
 * reason: the root layout mounts `NextIntlClientProvider messages={null}` so the full catalogue —
 * the whole B1–B11 label set in three languages — never reaches the browser against NFR-43's LCP
 * budget. Omitting this is not a subtle failure: every client component below throws
 * `MISSING_MESSAGE` at render, which is how this one was found.
 *
 * `identity.unreachable` is passed as a narrow slice rather than the namespace. It is the shared
 * "we could not reach the service" triple every screen needs, and it lives under `identity` only
 * because identity was the first tier to need it; the honest home is `chrome`, and moving it is a
 * catalogue change with existing readers to update rather than something to do in passing here.
 *
 * **`forms` is that move, made for the one case that had four readers** (28 Aug 2026). This layout
 * used to hand-assemble a two-key fragment of `identity.register` here, because the password
 * field's reveal toggle needed an accessible name and the register screen happened to declare it
 * first. `show` and `hide` belong to no screen — `packages/ui` owns no text (UX-79), so the app
 * supplies them, and every password field in the product needs the same two words. A top-level
 * `forms` namespace is what that is, and it deletes the fragment along with the duplicate pair
 * `identity.signIn` was carrying and the `tPolicy` alias two `features/credentials` components had
 * copied for strings that are not a policy.
 */
export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const messages = await getMessages();

  return (
    <NextIntlClientProvider
      messages={{
        chrome: messages.chrome,
        organization: messages.organization,
        // The reveal-toggle labels, as their own namespace rather than a fragment of a screen's.
        forms: messages.forms,
        identity: {
          unreachable: messages.identity.unreachable,
          // S-28's own namespace (task 27.7) — its board is a Client Component, and the root
          // layout ships `messages={null}` on purpose, so a namespace reaches the browser only
          // by being named here.
          credentials: messages.identity.credentials,
        },
      }}
    >
      {/* The tier itself is `packages/ui`'s WorkspaceNav, wired in `shared/` — task 26.4 built it
          because S-16 was the first screen in this group and had no way to be reached. Task 30.1
          adds the global tier above it and extends its link set; this layout does not change. */}
      <WorkspaceNavigation />
      {children}
    </NextIntlClientProvider>
  );
}
