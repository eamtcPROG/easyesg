'use client';

import { WorkspaceNav } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';

/**
 * §4.2's **workspace** tier, wired (task 26.4).
 *
 * Built here rather than with the global tier because S-16 is the first `(app)/(workspace)` screen
 * and had no way to be reached. The presentational half is `packages/ui`'s `WorkspaceNav` — an
 * inventory addition, per UX-89 — and this is the part that cannot live there: the routes, the
 * localized labels, and the locale-aware `Link` that `next/link` would silently break.
 *
 * **The set holds the sections that render.** Today that is one, because every other
 * `(workspace)` screen still returns `null`, and a nav item leading to a blank page is worse than
 * an absent one — it teaches the reader that the product is broken rather than unfinished.
 * Task 30.1 builds the global tier above this and extends this array as its screens land; §4.2's
 * full set is Reports, Entities & periods, Organization, Users & access, and Plan & billing.
 *
 * A Client Component for one reason: `usePathname`. Marking the current section is the tier's
 * whole navigational job, and the alternative — every page passing its own key down through the
 * layout — is a prop that one screen eventually forgets to pass, with no way to notice.
 */
const SECTIONS = [{ key: 'users', href: '/organization/users' }] as const;

export function WorkspaceNavigation() {
  const t = useTranslations('chrome.workspaceNav');
  const pathname = usePathname();

  return (
    <WorkspaceNav
      label={t('label')}
      items={SECTIONS.map((section) => ({
        key: section.key,
        current: pathname === section.href,
        link: <Link href={section.href}>{t(section.key)}</Link>,
      }))}
    />
  );
}
