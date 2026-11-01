'use client';

import { TextLink } from '@easyesg/ui';
import { useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { probeSession } from '@/client/session/session-probe';
import { ROUTES } from '@/lib/routes';
import { SESSION_STANDING } from '@/lib/session-standing';

/**
 * The 404's way back, decided in the browser — task 74.4 (project owner, 23 Oct 2026; `architecture.md` §12.5.6's
 * task-74 row (4)).
 *
 * **Why not on the server, as *not yet available*'s is.** `[locale]/not-found.tsx` is handed to its layout as an
 * element, and a Server Component renders such an element eagerly on every page beneath it, 404 or not. A cookie read
 * there made every page under `[locale]` dynamic, the marketing home included, which §14.2 lets the framework cache and
 * nothing else. So the server renders the signed-out way back — sign-in, which a visitor needs and a member can use —
 * and this asks task 92's probe, `GET /auth/session`, once the page is in the browser: a held session turns it into the
 * way to the workspace's home, the link task 103 gave a member.
 *
 * **An effect, not a query**: one read on arrival with nothing to refetch or share, on a surface rendered outside every
 * group's layout, where no Query provider is mounted. A probe that cannot reach the web tier answers *held* by its own
 * rule, and the home link then bounces a visitor to sign-in through the proxy — the same place, one hop later.
 */
export function ProbedReturnLink({
  actionHome,
  actionSignIn,
}: {
  readonly actionHome: string;
  readonly actionSignIn: string;
}) {
  const [held, setHeld] = useState(false);

  useEffect(() => {
    let current = true;
    void probeSession().then((standing) => {
      if (current) setHeld(standing === SESSION_STANDING.HELD);
    });
    return () => {
      current = false;
    };
  }, []);

  return (
    <TextLink asChild>
      <Link href={held ? ROUTES.HOME : ROUTES.SIGN_IN}>{held ? actionHome : actionSignIn}</Link>
    </TextLink>
  );
}
