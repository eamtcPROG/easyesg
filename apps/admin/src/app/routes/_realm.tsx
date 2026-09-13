import { Outlet, createFileRoute, redirect } from '@tanstack/react-router';
import { ConsoleChrome } from '~/realm/components/chrome/console-chrome';
import { adminSessionQuery } from '~/realm/queries/session';

/**
 * Realm layout — the signed-in console chrome for every screen behind the administrative realm.
 *
 * Pathless, so it adds no URL segment. **The guard is `beforeLoad`, and its default is closed**
 * (task 23): every route below resolves the session probe — the api judging the sealed cookie,
 * rotation included (OQ-17) — and an unauthenticated arrival is redirected to A-01 with the
 * intended destination carried in `?redirect=`, the console's UX-38. The probe is server state
 * in the router's query client, so the chrome and any later screen read the same answer.
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
 * **The chrome is task 67.1's** (`realm/components/chrome/`), replacing task 23's interim strip. It
 * takes the account the guard resolved, so the bar's realm and the navigation's section are chosen
 * from the same answer that let the operator in. It is presentation, never the boundary:
 * `AdminRealmGuard` (task 67.3) is what refuses a route to the wrong privilege level.
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

  return (
    <ConsoleChrome account={account}>
      <Outlet />
    </ConsoleChrome>
  );
}
