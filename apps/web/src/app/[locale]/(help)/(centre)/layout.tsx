import type { ReactNode } from 'react';
import { HelpWorkspaceFrame } from '@/shared/help-workspace-frame';

/**
 * S-32's own frame (task 227; artboard 01): for a signed-in reader acting for an organization, the workspace tier
 * beneath the global tier, as on every workspace screen — the help centre is a way back into the work (S-32's exit),
 * and the artboard draws it there. A visitor, and a reader of no organization, get the page alone. **Its own group**
 * because S-33 and S-34 draw the trail bar in that place instead (artboards 03 and 04).
 */
export default function HelpCentreLayout({ children }: { children: ReactNode }) {
  return <HelpWorkspaceFrame>{children}</HelpWorkspaceFrame>;
}
