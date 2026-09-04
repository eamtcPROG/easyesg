import type { ReactNode } from 'react';
import { PublicHeader } from '@/shared/public-header';

/**
 * The public surface — marketing, legal, help centre (IMPLEMENTATION_PLAN Phase 10).
 *
 * This is the **only** part of the application where `"use cache"` is legitimate. §14.2 names
 * the exception precisely: "fully static, tenant-independent content: the marketing shell, the
 * legal pages, the locale bundles". Everywhere else the directive is prohibited and a lint rule
 * enforces it, because a cache key the compiler generated without knowing about organization_id
 * would leak a rendered page across tenants ABOVE the RLS boundary of AD-2.
 *
 * Phase 10 depends on nothing from phases 4-9, and nothing later depends on it. The
 * `web-public-is-a-leaf` boundary rule keeps that true.
 *
 * **The chrome is rendered here, not per screen (task 74.1)** — the mirror of `(app)`'s layout
 * holding `GlobalTier`, and for the same reason: "on every screen in the group" is a property of
 * the layout, and a header composed per page is one a new page can be added without. `/`, `/help`
 * and `/legal/*` are all inside the group, so all three gain it at once.
 *
 * **The footer is deliberately not here yet.** Task 74.1's other half is `SiteFooter`, which links
 * to the three legal documents — every one of which returns `null` until task 75.3, the row that
 * already records those as dead links shipping on the identity screens today. Placing it here
 * would spread a known defect onto a second surface to close a task row a day earlier.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PublicHeader />
      {children}
    </>
  );
}
