import { useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { ADMIN_SESSION_QUERY_KEY } from '../../queries/session';

/**
 * What a console screen does when its own read answers 401 — the session ended between the realm
 * guard's probe and this read (task 145), and the operator wants A-01 carrying this address rather
 * than an explanation (`realm-read.ts`'s `SIGNED_OUT` arm).
 *
 * **It records the ending before it navigates, and that half is task 113's.** Six sections drew the
 * bare `<Navigate to="/sign-in" search={{ redirect: href }} />` and left `adminSessionQuery` holding
 * the account for the rest of its 60-second window — so the console believed it was signed in while
 * every screen was being refused. It cost nothing visible until A-01 gained a gate of its own, at
 * which point the stale answer bounces the operator back to the screen that had just refused them,
 * and back again, without end. Writing `null` is what makes both guards agree with the api.
 *
 * **One effect, so the order is this file's rather than React's.** Rendering `<Navigate>` beside an
 * effect would put the navigation in a *child*, whose effects run first — the ordering the loop
 * needs would then be a property of the tree rather than of anything written here.
 *
 * **In `components/shared/` on one test: is it read by more than one surface?** Six, across both
 * bounded contexts and the realm itself — A-02, A-08, A-18, A-07's two, and A-19's recovery codes —
 * which is also why it is in `realm/` rather than in a feature: `admin-realm-is-a-leaf` runs the
 * other way, and a realm screen may not reach into `features/`.
 */
export function SessionEnded() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const href = useLocation({ select: (location) => location.href });

  useEffect(() => {
    queryClient.setQueryData(ADMIN_SESSION_QUERY_KEY, null);
    void navigate({ to: '/sign-in', search: { redirect: href } });
  }, [queryClient, navigate, href]);

  return null;
}
