import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Outlet, createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { ADMIN_SESSION_QUERY_KEY, adminSessionQuery, signOut } from '~/realm/session';
import { SessionStrip } from '~/realm/components/session-strip';

/**
 * Realm layout — the signed-in console chrome for every screen behind the administrative realm.
 *
 * Pathless, so it adds no URL segment. **The guard is `beforeLoad`, and its default is closed**
 * (task 23): every route below resolves the session probe — the api judging the sealed cookie,
 * rotation included (OQ-17) — and an unauthenticated arrival is redirected to A-01 with the
 * intended destination carried in `?redirect=`, the console's UX-38. The probe is server state
 * in the router's query client, so the strip and any later screen read the same answer.
 *
 * Two properties are stated once here rather than repeated on all eighteen screens, per
 * `design_spec.md` §5.2's own preamble: compact density, and `wide`/`extra` viewports only
 * (UX-77's narrow-viewport notice belongs in this layout and is still blocked on OQ-13's
 * breakpoint values).
 *
 * The absence of any tenant-scoped context here is deliberate and load-bearing. This console
 * has no active organization: D-5 gives a Platform Administrator no standing access to any
 * organization's report data, and the only path to it is A-07's time-boxed grant. An
 * organization selector in this chrome would be that standing access, arriving as a
 * convenience.
 *
 * The strip is task 23's interim rendering of the chrome's account corner — task 67's row in
 * docs/task.md owns replacing it.
 */
export const Route = createFileRoute('/_realm')({
  beforeLoad: async ({ context, location }) => {
    const account = await context.queryClient.ensureQueryData(adminSessionQuery);
    if (account === null) {
      throw redirect({ to: '/sign-in', search: { redirect: location.href } });
    }
    return { account };
  },
  component: RealmLayout,
});

function RealmLayout() {
  const { account } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const signOutMutation = useMutation({
    mutationFn: signOut,
    // Settled, not success: the cookie is cleared even when the api was unreachable (the
    // service's own stance), so the console's view follows suit and the operator leaves.
    onSettled: async () => {
      queryClient.setQueryData(ADMIN_SESSION_QUERY_KEY, null);
      await navigate({ to: '/sign-in' });
    },
  });

  return (
    <>
      <SessionStrip
        email={account.email}
        busy={signOutMutation.isPending}
        onSignOut={() => signOutMutation.mutate()}
      />
      <Outlet />
    </>
  );
}
