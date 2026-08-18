import type { ReactNode } from 'react';

/**
 * Screens that carry the **workspace** navigation tier (§4.2): Reports, Entities & periods,
 * Organization, Users & access, Plan & billing.
 *
 * This route group exists to express UX-5. The wizard suppresses this tier and replaces it with
 * the module list, so the wizard cannot nest inside this layout - it is a sibling group,
 * `(wizard)`, over the same URL space. Route groups add no path segment, which is what lets
 * `/reports` and `/reports/:id/:module` sit under different layout ancestries without either
 * one knowing about the other.
 */
export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
