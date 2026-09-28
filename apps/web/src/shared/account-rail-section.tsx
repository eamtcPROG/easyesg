import { mayAdminister, readActiveMembership } from '@/server/data/memberships';
import { AccountRail } from './account-rail';
import { workspaceSectionsFor } from './workspace-sections';

/**
 * The account rail's read (task 173): which workspace sections this reader's role opens — the band's read, for the
 * two screens where the rail is the workspace tier (§4.2's amendment of 24 Sep 2026).
 *
 * **Its own Server Component because the layout is a shell** and the rail is a Client Component, which cannot read.
 * **No request of its own**: `readActiveMembership` is built on the `cache()`d read the global tier makes in the same
 * render, so `GET /memberships` still goes out once.
 */
export async function AccountRailSection() {
  const membership = await readActiveMembership();

  return <AccountRail sections={workspaceSectionsFor(mayAdminister(membership))} />;
}
