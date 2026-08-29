'use client';

import { WorkspaceNav } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';

/**
 * §4.2's **workspace** tier, wired (task 26.4).
 *
 * Built with task 26.4 rather than with the global tier because S-16 was the first
 * `(app)/(workspace)` screen and had no way to be reached. The presentational half is
 * `packages/ui`'s `WorkspaceNav` — an inventory addition, per UX-89 — and this is the part that
 * cannot live there: the routes, the localized labels, and the locale-aware `Link` that
 * `next/link` would silently break.
 *
 * **The set holds the sections that render.** Today that is one, because every other
 * `(workspace)` screen still returns `null`, and a nav item leading to a blank page is worse than
 * an absent one — it teaches the reader that the product is broken rather than unfinished. §4.2's
 * full set is Reports, Entities & periods, Organization, Users & access, and Plan & billing, and
 * tasks 30.3, 30.4 and 30.5 are what add them here.
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
const SECTIONS = [
  // S-15, added with task 30.3 — §4.2's *Organization*, and the first entry this tier has gained
  // rather than lost. It sits before *Users & access* because §4.2 lists it there and because the
  // reading order is the object then its people.
  { key: 'organization', href: ROUTES.ORGANIZATION },
  { key: 'users', href: ROUTES.ORGANIZATION_USERS },
] as const;

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
