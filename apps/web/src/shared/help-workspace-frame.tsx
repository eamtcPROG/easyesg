import type { ReactNode } from 'react';
import { readActiveMembership } from '@/server/data/memberships';
import { readSession } from '@/server/session/session';
import { WorkspaceNavigationSection } from './workspace-navigation-section';
import styles from './help-workspace-frame.module.css';

/**
 * The workspace tier above S-32 for a signed-in reader acting for an organization (task 227; artboard 01) — the
 * `(workspace)` layout's frame: the tier stays in place under the band and only the page beneath it scrolls (28 Sep
 * 2026, project owner). **It reads the session only to choose**, as `(help)`'s layout does (§12.5.6's task-77 row
 * (10)); the membership read is the one `GlobalTier` already made, `cache()`d. A visitor and a reader of no
 * organization get the page alone.
 *
 * **In `shared/`** because it is chrome owned by no feature, beside the two frames `(help)`'s layout chooses between.
 */
export async function HelpWorkspaceFrame({ children }: { readonly children: ReactNode }) {
  const membership = (await readSession()) === null ? null : await readActiveMembership();
  if (membership === null) return children;

  return (
    <div className={styles.page}>
      <WorkspaceNavigationSection />
      <div className={styles.scroll}>{children}</div>
    </div>
  );
}
