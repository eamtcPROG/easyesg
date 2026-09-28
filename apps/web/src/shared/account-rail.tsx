'use client';

import { ARIA_CURRENT, LockedNavEntry } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { ACCOUNT_SECTIONS } from './account-sections';
import type { WorkspaceSection } from './workspace-sections';
import styles from './account-rail.module.css';

/**
 * The account pages' left rail — S-27's and S-28's chrome as `EasyESG Identity.dc.html` draws it at 1440: the
 * workspace sections, a rule, then *Profile* and *Credentials*, the current one on the accent tint.
 *
 * **It replaces the workspace band on these two screens rather than sitting under it** (project owner, 24 Sep 2026;
 * `design_spec.md` §4.2's amendment of that date). The rail already carries the workspace sections, so the band as
 * well would draw one tier twice — which is why the `(account)` route group is a sibling of `(workspace)`, as
 * `(wizard)` is, rather than a conditional render inside it.
 *
 * **This application's, not `packages/ui`'s** (UX-89 as amended 14 Sep 2026): only the tenant application has an
 * account section, and the anatomy is neither `WorkspaceNav`'s band nor `ConsoleNav`'s headed dark column. It takes
 * colour, space and type from the token cascade only, and moves to the inventory the day the console needs it.
 *
 * **Two landmarks, not one list with a divider in it**: the upper half is the workspace tier and keeps the band's
 * accessible name, the lower is the account's and keeps the account menu's, so a screen reader moving by landmark
 * hears the same two names it hears everywhere else. Below the compact boundary the rail is not drawn at all and the
 * chrome drawer carries both halves — the artboard's *"top sheet at compact"*.
 *
 * **What it carries is what renders**, as the band does: the artboard's *Plan & billing* arrives with Phase 7's screens,
 * through `WORKSPACE_SECTIONS`, and not before. **And a section the reader's role may not open is drawn locked**, as
 * the band draws it (task 173) — `sections` arrives from `AccountRailSection`, which read the membership; the lock is
 * `packages/ui`'s `LockedNavEntry`, since the icon set is that package's alone.
 *
 * A Client Component for `usePathname` alone — marking the current destination is the rail's whole navigational job.
 */
export function AccountRail({ sections }: { readonly sections: readonly WorkspaceSection[] }) {
  const tSections = useTranslations('chrome.workspaceNav');
  const tAccount = useTranslations('chrome.accountMenu');
  const pathname = usePathname();

  return (
    <div className={styles.rail}>
      <nav aria-label={tSections('label')}>
        <RailLinks
          pathname={pathname}
          links={sections.map((section) => ({
            href: section.href,
            label: tSections(section.key),
            lockedNote: section.locked ? tSections('lockedNote') : undefined,
          }))}
        />
      </nav>
      <nav className={styles.account} aria-label={tAccount('label')}>
        <RailLinks
          pathname={pathname}
          links={ACCOUNT_SECTIONS.map((section) => ({ href: section.href, label: tAccount(section.key) }))}
        />
      </nav>
    </div>
  );
}

/**
 * One half of the rail. Every destination is a leaf address, so the current one is an exact match. A row carrying a
 * `lockedNote` is drawn locked and is never current — the band's rule.
 */
function RailLinks({
  links,
  pathname,
}: {
  readonly links: readonly { readonly href: string; readonly label: string; readonly lockedNote?: string }[];
  readonly pathname: string;
}) {
  return (
    <ul className={styles.list}>
      {links.map((link) => (
        <li key={link.href}>
          {link.lockedNote === undefined ? (
            <Link
              className={styles.link}
              href={link.href}
              aria-current={link.href === pathname ? ARIA_CURRENT.PAGE : undefined}
            >
              {link.label}
            </Link>
          ) : (
            <LockedNavEntry label={link.label} note={link.lockedNote} className={styles.locked} />
          )}
        </li>
      ))}
    </ul>
  );
}
