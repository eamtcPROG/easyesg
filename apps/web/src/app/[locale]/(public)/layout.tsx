import type { ReactNode } from 'react';
import { PublicFooter } from '@/shared/public-footer';
import { PublicHeader } from '@/shared/public-header';
import styles from './layout.module.css';

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
 * **And the footer since 9 Oct 2026** (74.1's other half; `architecture.md` §12.5.6's task-74 row, item (1)). It was
 * held back on 4 Sep because its three legal links returned `null`; since task 103 they answer a designed *not yet
 * available* with a way back, as they already do from the identity and workspace screens, until task 75 publishes the
 * documents.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.frame}>
      <PublicHeader />
      {children}
      <PublicFooter />
    </div>
  );
}
