import { mayAdminister, readActiveMembership } from '@/server/data/memberships';
import { WorkspaceNavigation } from './workspace-navigation';
import { workspaceSectionsFor } from './workspace-sections';

/**
 * The workspace band's read (task 173): which sections this reader's role opens, decided where the membership is.
 *
 * **Its own Server Component because the layout is a shell** (`shell-composes-only`) and the band is a Client
 * Component, which cannot read. **No request of its own**: `readActiveMembership` is built on the `cache()`d read the
 * global tier makes in the same render, so `GET /memberships` still goes out once.
 */
export async function WorkspaceNavigationSection() {
  const membership = await readActiveMembership();

  return <WorkspaceNavigation sections={workspaceSectionsFor(mayAdminister(membership))} />;
}
