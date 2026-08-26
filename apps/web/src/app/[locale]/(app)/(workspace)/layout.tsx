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
 */
export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const messages = await getMessages();

  return (
    <NextIntlClientProvider
      messages={{
        chrome: messages.chrome,
        organization: messages.organization,
        identity: { unreachable: messages.identity.unreachable },
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
