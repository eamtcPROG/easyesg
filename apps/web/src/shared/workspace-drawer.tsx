'use client';

import { BrandMark, ChromeDrawer, type SwitcherLocale } from '@easyesg/ui';
import type { Locale } from '@easyesg/i18n';
import { useSearchParams } from 'next/navigation';
import { Link, usePathname } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import { signOutAction } from '@/features/identity/actions';
import { WORKSPACE_SECTIONS } from './workspace-sections';
import styles from './workspace-drawer.module.css';

/**
 * §4.2's chrome at `compact`, wired (task 108) — the app's half of `ChromeDrawer`.
 *
 * **A Client Component for the same two reasons `AccountCorner` is one**: `usePathname` marks the
 * current section, and language is URL state, so a locale choice is a link to *this* address in
 * another locale and only the browser knows what that address is. Labels arrive as props, resolved
 * by `GlobalTier` on the server.
 *
 * **It renders its own sign-out form rather than borrowing the account corner's.** Both are hidden
 * forms driven by a `form=`-associated submit button — the shape `account-corner.tsx` documents,
 * because Radix portals its surface and ARIA does not admit a `<form>` inside `role="menu"`. Reusing
 * the corner's id would have been one form and two buttons, and would have made the drawer's
 * sign-out depend silently on a sibling being rendered.
 *
 * **What it carries is what renders.** The specimen's *Plan & billing*, *Notifications* and *Help
 * centre* are Phase 7's, task 50.2's and task 77.5's. The **language choice is here although the
 * specimen omits it**, and that is UX-76 rather than a preference: the compact bar drops the
 * account menu, so a locale switch omitted here would be a task made unavailable by viewport, which
 * UX-76 prohibits without an explicit statement of why and what device to use.
 */
const SIGN_OUT_FORM = 'workspace-drawer-sign-out';

export interface WorkspaceDrawerProps {
  readonly locale: Locale;
  readonly locales: readonly SwitcherLocale<Locale>[];
  readonly labels: {
    readonly menu: string;
    readonly close: string;
    readonly sections: string;
    readonly credentials: string;
    readonly signOut: string;
    readonly language: string;
  };
  /** The five section names in the reader's language, in the tier's own order. */
  readonly sectionLabels: Readonly<Record<string, string>>;
}

export function WorkspaceDrawer({ locale, locales, labels, sectionLabels }: WorkspaceDrawerProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // The query travels with a locale switch, exactly as it does in the account corner: UX-4 makes
  // the address the state, and on this tier that address is often a filtered Index.
  const query = searchParams.toString();
  const target = query ? `${pathname}?${query}` : pathname;

  return (
    <>
      <form id={SIGN_OUT_FORM} action={signOutAction.bind(null, undefined)} hidden />
      <ChromeDrawer
        label={labels.menu}
        closeLabel={labels.close}
        sectionsLabel={labels.sections}
        brand={<BrandMark />}
        linkComponent={Link}
        items={WORKSPACE_SECTIONS.map((section) => ({
          ...section,
          label: sectionLabels[section.key] ?? section.key,
        }))}
        isActive={(item) => item.href === pathname}
        actions={
          <>
            <Link className={styles.action} href={ROUTES.ACCOUNT_CREDENTIALS}>
              {labels.credentials}
            </Link>
            <p className={styles.group}>{labels.language}</p>
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
              form={SIGN_OUT_FORM}
              onClick={(event) => {
                // The panel closes on click, unmounting the button before the default submit runs
                // — the same race `account-corner.tsx` records for the portalled menu.
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }}
            >
              {labels.signOut}
            </button>
          </>
        }
      />
    </>
  );
}
