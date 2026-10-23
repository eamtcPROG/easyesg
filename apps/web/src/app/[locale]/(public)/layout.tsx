import type { ReactNode } from 'react';
import { PublicFooter } from '@/shared/public-footer';
import { PublicHeader } from '@/shared/public-header';
import { activateRequestLocale, type LocaleParams } from '@/i18n/page';
import styles from './layout.module.css';

/**
 * The public surface — marketing, legal, help centre (IMPLEMENTATION_PLAN Phase 10).
 *
 * This is the **only** part of the application the framework may cache. §14.2 names the exception
 * precisely: "fully static, tenant-independent content". Everywhere else a cache key that knows
 * nothing of organization_id would leak a rendered page across tenants ABOVE the RLS boundary of
 * AD-2. **The caching is static rendering, not `"use cache"`** (task 74.4; §14.2 amended
 * 23 Oct 2026): the directive needs the application-wide Cache Components flag and stays banned
 * here too. So this layout forces nothing — every other group forces `force-dynamic` itself — the
 * marketing home is prerendered and revalidated, and the legal document page opts back out because
 * it reads A-21's operator per request. `e2e/web/static-rendering.spec.ts` is the gate.
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
 * held back on 4 Sep because its three legal links returned `null`; since task 103 they answered a designed *not yet
 * available* with a way back, and since task 75 all three open their document.
 */
export default async function PublicLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: LocaleParams;
}) {
  // **The locale pinned here too, or nothing in the zone is static** (task 74.4). Next renders a layout beside its page
  // rather than before it, so the root layout's pin does not reach this one, and the header's `getTranslations` would
  // otherwise resolve the locale from the request's headers — which makes every page beneath dynamic, the home
  // included, with no error and no warning. Found by reading the build's route table, which drew `/[locale]` as `ƒ`.
  await activateRequestLocale(params);

  return (
    <div className={styles.frame}>
      <PublicHeader />
      {children}
      <PublicFooter />
    </div>
  );
}
