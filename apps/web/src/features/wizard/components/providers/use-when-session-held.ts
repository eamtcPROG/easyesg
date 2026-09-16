'use client';

import { probeSession } from '@/client/session/session-probe';
import { SESSION_STANDING } from '@/lib/session-standing';
import { useAutosaveContext } from './autosave-context';

/**
 * S-07's navigations ask first (task 92; UX-38 — `architecture.md` §12.5.6's task-92 row).
 *
 * A step change or the exit that met an ended session would be answered by the proxy with the sign-in
 * screen, which is the redirect UX-38 rules out. So the rail and the exit hand their navigation to this:
 * the session tier is asked, a held session proceeds, and an ended one is told to autosave's state — which
 * opens the dialogue over the step the reader is still on. **The navigation is not replayed after
 * resuming**: *continue where I left off* names the step, and the reader asks for the next one again.
 *
 * Beside the context because it reads it, and a hook because the rail link and the exit are two readers.
 */
export function useWhenSessionHeld(): (proceed: () => void) => void {
  const { endSession } = useAutosaveContext();
  return (proceed) => {
    void probeSession().then((standing) => {
      if (standing === SESSION_STANDING.ENDED) endSession();
      else proceed();
    });
  };
}
