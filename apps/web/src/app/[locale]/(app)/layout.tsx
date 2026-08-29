import type { ReactNode } from 'react';
import { GlobalTier } from '@/shared/global-tier';

/**
 * The authenticated shell. `proxy.ts` guarantees a session above this point.
 *
 * Renders the **global** navigation tier and nothing else (§4.2): active organization switcher,
 * notification centre, user menu (profile, language, sign out), help. Three tiers exist and
 * there is no fourth.
 *
 * UX-2: the active organization is visible at all times and is **never** inferred from a URL
 * segment or a request header - it is a property of the session. That is why no route below
 * here carries an organization id: a second source would turn an org-switch race or a revoked
 * membership into a cross-tenant read (AD-2).
 *
 * UX-3: switching organization returns the user to the equivalent screen in the new
 * organization where one exists, and to that organization's home otherwise - and never
 * silently discards unsaved work. Unsynced changes flush first.
 */
/**
 * Nothing below this layout is ever prerendered or cached.
 *
 * This is the third leg of the same rule, and the only one that is a positive assertion rather
 * than a prohibition: `cacheComponents: false` in next.config.ts disables the mechanism, the
 * ESLint rule bans the `"use cache"` directive, and this makes every authenticated route
 * dynamic even before it reads a cookie. §14.2's reasoning is that a cache key generated
 * without knowledge of organization_id would leak a rendered page across tenants ABOVE the RLS
 * boundary of AD-2, where none of its probes would catch it.
 *
 * At scaffold stage it also has a visible effect: these pages read nothing yet, so Next would
 * happily prerender all of them. A page that is statically correct today and tenant-scoped
 * tomorrow is exactly the drift this prevents.
 */
export const dynamic = 'force-dynamic';

export default function AppLayout({ children }: { children: ReactNode }) {
  // The real §4.2 global tier since task 30.1. Task 22's interim `SessionStrip` is deleted, not
  // left dead — it named this task as its owner in its own comment, and the comment went with it.
  //
  // It is rendered here rather than in `(workspace)` because "present on every authenticated
  // screen" includes the two `(app)` screens that are NOT in that group: S-04, where there is no
  // organization to name yet, and S-35, where the read that would name it has just failed. Both
  // are the band's designed empty state rather than a second layout.
  return (
    <>
      <GlobalTier />
      {children}
    </>
  );
}
