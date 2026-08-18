import type { ReactNode } from 'react';

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
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
