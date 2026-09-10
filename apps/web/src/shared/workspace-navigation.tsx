'use client';

import { WorkspaceNav } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { WORKSPACE_SECTIONS } from './workspace-sections';

/**
 * §4.2's **workspace** tier, wired (task 26.4).
 *
 * Built with task 26.4 rather than with the global tier because S-16 was the first
 * `(app)/(workspace)` screen and had no way to be reached. The presentational half is
 * `packages/ui`'s `WorkspaceNav` — an inventory addition, per UX-89 — and this is the part that
 * cannot live there: the routes, the localized labels, and the locale-aware `Link` that
 * `next/link` would silently break.
 *
 * **The set holds the sections that render**, and a nav item leading to a blank page is worse than
 * an absent one — it teaches the reader that the product is broken rather than unfinished. §4.2's
 * full set is Home, Reports, Entities & periods, Organization, Users & access, and Plan & billing —
 * six since the 10 Sep 2026 amendment — of which five render; *Plan & billing* is absent because
 * its screens are Phase 7's.
 *
 * **S-28 left this set in task 30.1**, which is the correction that task promised rather than a
 * change of mind. Task 27.7 put credentials here with its reason stated — §4.2 puts it under the
 * account corner, no account corner existed, and an unreachable screen is worse than a temporarily
 * misplaced link. The corner exists now, so the link is where §4.2 says it belongs and this tier is
 * organization sections only, which is what its own accessible name has claimed all along.
 *
 * A Client Component for one reason: `usePathname`. Marking the current section is the tier's
 * whole navigational job, and the alternative — every page passing its own key down through the
 * layout — is a prop that one screen eventually forgets to pass, with no way to notice.
 */

export function WorkspaceNavigation() {
  const t = useTranslations('chrome.workspaceNav');
  const pathname = usePathname();

  return (
    <WorkspaceNav
      label={t('label')}
      // The locale-aware `Link`, injected: `packages/ui` holds no router, and a raw `next/link`
      // would drop the prefix. The component builds the anchor and owns `aria-current` with it.
      linkComponent={Link}
      // **The only mapping left is the label**, and it cannot be removed: this package owns no text
      // (UX-79), so the localized string has to arrive from here. `key` and `href` pass through
      // untouched, which is what task 105's API change was for — the previous shape needed a
      // rendered anchor and a resolved boolean per entry, built in this `.map` on every render.
      items={WORKSPACE_SECTIONS.map((section) => ({ ...section, label: t(section.key) }))}
      // Exact comparison, because every section in this tier is a leaf address. A nav whose
      // sections had children would pass a prefix match instead, which is why the component takes
      // the predicate rather than an active key.
      isActive={(item) => item.href === pathname}
    />
  );
}
