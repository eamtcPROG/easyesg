'use client';

import { BrandMark, ChromeDrawer } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { Link, usePathname } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import { useSignOut } from '@/features/identity/shared/components/sign-out-provider';
import { useLocaleNames } from './use-locale-names';
import { WORKSPACE_SECTIONS } from './workspace-sections';
import styles from './workspace-drawer.module.css';

/**
 * §4.2's chrome at `compact`, wired (task 108) — the app's half of `ChromeDrawer`.
 *
 * **A Client Component for the same two reasons `AccountCorner` is one**: `usePathname` marks the
 * current section, and language is URL state, so a locale choice is a link to *this* address in
 * another locale and only the browser knows what that address is. **Its words are its own** (task
 * 158), read from `chrome` the way `WorkspaceNavigation` reads the same section names — they used to
 * arrive as props from `GlobalTier`, which made the band and the drawer two places to resolve one
 * tier's labels.
 *
 * **Its sign-out is the layout's, shared with the account corner since task 93.** Each rendered its own
 * hidden form until then, so that neither depended on a sibling being rendered; now both depend on
 * `SignOutProvider`, which the `(app)` layout renders above both — the only place a sign-out can wait for
 * unsent answers, since this panel closes on the press (UX-37). The button keeps its `form=`
 * association, which is what still signs a reader out before hydration.
 *
 * **What it carries is what renders.** The specimen's *Plan & billing*, *Notifications* and *Help
 * centre* are Phase 7's, task 50.2's and task 77.5's. The **language choice is here although the
 * specimen omits it**, and that is UX-76 rather than a preference: the compact bar drops the
 * account menu, so a locale switch omitted here would be a task made unavailable by viewport, which
 * UX-76 prohibits without an explicit statement of why and what device to use.
 */
export interface WorkspaceDrawerProps {
  /**
   * The organization's switcher (task 83.2), at the head of the panel — the compact bar names no organization
   * (`design_spec.md` UX-2's amendment), so this is where it is. Absent when the session acts for none.
   */
  readonly organization?: ReactNode;
}

export function WorkspaceDrawer({ organization }: WorkspaceDrawerProps) {
  const t = useTranslations('chrome');
  const tSections = useTranslations('chrome.workspaceNav');
  const { formId, requestSignOut } = useSignOut();
  const { locale, locales } = useLocaleNames();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // The query travels with a locale switch, exactly as it does in the account corner: UX-4 makes
  // the address the state, and on this tier that address is often a filtered Index.
  const query = searchParams.toString();
  const target = query ? `${pathname}?${query}` : pathname;

  return (
    <>
      <ChromeDrawer
        label={t('drawer.label')}
        closeLabel={t('drawer.close')}
        // The band's own accessible name, reused: the drawer IS the workspace tier at this frame, so a
        // second name for it would describe two navigations.
        sectionsLabel={tSections('label')}
        brand={<BrandMark />}
        linkComponent={Link}
        items={WORKSPACE_SECTIONS.map((section) => ({ ...section, label: tSections(section.key) }))}
        isActive={(item) => item.href === pathname}
        organization={organization}
        actions={
          <>
            <Link className={styles.action} href={ROUTES.ACCOUNT_CREDENTIALS}>
              {t('accountMenu.credentials')}
            </Link>
            <p className={styles.group}>{t('language')}</p>
            {locales.map((entry) => (
              <Link
                key={entry.code}
                className={styles.action}
                href={target}
                locale={entry.code}
                aria-current={entry.code === locale ? 'true' : undefined}
              >
                {entry.label}
              </Link>
            ))}
            <button
              className={styles.action}
              type="submit"
              form={formId}
              onClick={(event) => {
                // The panel closes on click, unmounting the button before the default submit runs
                // — the same race `account-corner.tsx` records for the portalled menu. The provider
                // above the panel is what carries the sign-out through it, and what waits for a queue.
                event.preventDefault();
                requestSignOut();
              }}
            >
              {t('accountMenu.signOut')}
            </button>
          </>
        }
      />
    </>
  );
}
