import type { ReactNode } from 'react';
import { AccountRailSection } from '@/shared/account-rail-section';
import { OrganizationChoiceGate } from '@/shared/organization-choice-gate';
import { WorkspaceFooter } from '@/shared/workspace-footer';
import styles from './layout.module.css';

/**
 * The account pages — S-27 at `/account`, S-28 at `/account/credentials` — under the rail their artboards draw.
 *
 * **A sibling of `(workspace)`, not a folder inside it** (project owner, 24 Sep 2026; `design_spec.md` §4.2's
 * amendment of that date). `EasyESG Identity.dc.html` draws both screens with a left rail holding the workspace
 * sections, a rule, and the account's two destinations, and with no band above them. Inside `(workspace)` the band would
 * draw the same sections a second time, and suppressing it there would make it a conditional render — the shape
 * `(wizard)` is a sibling group to avoid (UX-5). Route groups add no path segment, so both addresses are unchanged.
 *
 * **S-37's gate renders first**, as it does in the two sibling groups: the rail names the organization's sections,
 * and a reader holding several memberships and no choice would meet refusals on every one of them.
 *
 * **`<main>` is here, beside the rail**, for the `(workspace)` layout's reason: every screen needs the landmark
 * 2.4.1's bypass-blocks technique relies on, and the navigation stays outside it.
 *
 * **The rail stays in place, and the record scrolls beside it with the footer beneath** (28 Sep 2026, project owner;
 * `design_spec.md` §4.2): the page fills the `(app)` layout's scroll region, the rail runs from the band to the foot of
 * the window, and only the column holding `<main>` and the footer moves — the same rule the workspace tier keeps. It
 * replaces 24 Sep 2026's footer spanning below the rail, which put the footer under navigation that no longer scrolls.
 */
export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <OrganizationChoiceGate />
      <div className={styles.page}>
        <AccountRailSection />
        <div className={styles.scroll}>
          <main className={styles.main}>{children}</main>
          <WorkspaceFooter />
        </div>
      </div>
    </>
  );
}
