import { Suspense, type ReactNode } from 'react';
import { PushProvider } from '@/client/push/push-provider';
import { QueryProvider } from '@/client/query/query-provider';
import { env } from '@/lib/env';
import { UnsentWorkProvider } from '@/client/unsent-work/unsent-work';
import { OrganizationSwitchNotice } from '@/features/organization/switcher/components/organization-switch-notice';
import { OrganizationSwitchProvider } from '@/features/organization/switcher/components/organization-switch-provider';
import { SignOutProvider } from '@/features/identity/shared/components/sign-out-provider';
import { SupportAccessBanners } from '@/features/support-access/components/section/support-access-banners';
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
  //
  // UX-124's support-access banners since task 67.9, here for the global tier's reason: *every signed-in screen*.
  // **Behind a boundary with no fallback**, deliberately against the one-skeleton-per-reading-region rule: the
  // banner's ordinary state is absent, so a skeleton would reserve and then collapse a band on nearly every render,
  // while no fallback lets the page flush without waiting on `GET /support-access` and the banner arrive after.
  //
  // **Task 83.2's two providers wrap all of it**, and the order is the dependency: the switch reads what is
  // unsent, and the tier's switcher and the wizard's autosave — in `children` — are both beneath the two. Both
  // are Client Components handed this layout's server children, which they render and never introspect. The
  // refusal notice sits directly below the band, where a switch made from a closed menu can still be answered.
  // **And task 93's sign-out beneath the registry too**, for the switch's reason: both controls that offer
  // it — the band's menu and the compact drawer — close on the press, so the wait, the question and the
  // submission live above them.
  //
  // **TanStack Query's client outermost since task 50.2.1**: the unread count in the band and the wizard's
  // autosave in `children` are its two consumers, and they share one client.
  //
  // **AD-15's accelerator inside it since task 149**: the surfaces it hurries are the count's query and S-16's
  // refresh, both below, and it draws nothing of its own. Its origin is read here, at request time, so no build inlines
  // it; unset, nothing is pushed and every surface runs on its poll.
  return (
    <QueryProvider>
      <PushProvider apiOrigin={env.publicApiOrigin}>
        <UnsentWorkProvider>
          <SignOutProvider>
            <OrganizationSwitchProvider>
              <GlobalTier />
              <OrganizationSwitchNotice />
              <Suspense fallback={null}>
                <SupportAccessBanners />
              </Suspense>
              {children}
            </OrganizationSwitchProvider>
          </SignOutProvider>
        </UnsentWorkProvider>
      </PushProvider>
    </QueryProvider>
  );
}
