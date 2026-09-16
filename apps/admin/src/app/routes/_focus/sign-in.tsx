/**
 * A-01 — Admin sign-in · PA, BO · UC-68, UC-212 · Focus · Phase 2 (task 23; two-step handshake
 * since the 24 Aug 2026 review; the recovery sign-in since task 151)
 *
 * Elevated sign-in for the administrative realm: the credential opens a sealed five-minute
 * challenge, the mandatory TOTP code completes it (FR-75, NFR-65) — this surface shares no
 * session, cookie scope or credential with the tenant application, and does not accept
 * ordinary tenant credentials. The session it establishes is the sealed httpOnly cookie the
 * api sets (OQ-17), 8 h idle / 12 h absolute (§12.5.6). The screen itself — card anatomy,
 * copy, states — is `realm/components/sign-in/sign-in-screen.tsx`; this route owns only the
 * addressable state: the sanitized `?redirect=` hand-off and the post-sign-in navigation.
 *
 * `?redirect=` is the realm guard's UX-38: the screen the closed-by-default `_realm` boundary
 * turned away. It round-trips the browser, so only a same-app path survives; everything else
 * lands on the operator's console home — A-02 for a Platform Administrator, A-10 for a Billing
 * Operator (A-01's exit, `design_spec.md` §5.2; task 67.1). **A recovery sign-in lands on A-19
 * instead, whatever `?redirect=` carried** (task 151): a code was just spent, perhaps for a lost
 * authenticator, and A-19 is where both are put right.
 *
 * **The gate runs in both directions since task 113** (UX-136; §12.5.6's task-113 row). `_realm` has
 * turned an unauthenticated arrival away since task 23 and nothing did the reverse, so an operator
 * holding a live session who typed this address, followed a bookmark or pressed back was served the
 * form — and submitting it re-ran the whole handshake and rotated the sealed cookie underneath a
 * session that was working. **The probe is the only fact available**: OQ-17 makes the cookie the
 * api's, httpOnly and on the api's origin, so there is nothing local to read. It costs little,
 * measured rather than assumed — `/` and `_realm` resolve the same 60-second entry, so the two ways
 * an anonymous operator ordinarily arrives here ask nothing, and a cookie-less `GET` is refused
 * before any database work.
 *
 * **A probe that cannot answer renders the form, and the asymmetry with `_realm` is the point**:
 * that guard is closed by default and a thrown probe keeps it closed; this screen is open by
 * default and a thrown probe keeps it open. Nothing is given away — the boundary that refuses an
 * attacker is the api's cookie, and this gate only spares an operator an accidental re-handshake —
 * while the opposite arm would make the console's only way in depend on the api being reachable.
 *
 * **`defaultPreload: 'intent'` runs this guard on hover and cannot act on it** (verified against the
 * router's own preloading guide, 16 Sep 2026): the speculative lane executes `beforeLoad` but does
 * not reuse its terminal outcomes, redirects among them, so A-20's *go to sign in* link warms the
 * probe and moves nobody. The redirect is re-derived on the real navigation.
 */
import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { ADMIN_SESSION_QUERY_KEY, adminSessionQuery } from '~/realm/queries/session';
import { SignInScreen } from '~/realm/components/sign-in/sign-in-screen';
import { consoleHomeFor } from '~/realm/tools/console-home';
import { CREDENTIALS_ARRIVAL } from '~/realm/tools/credentials-arrival';
import { readSignInNotice, type SignInNotice } from '~/realm/tools/sign-in-notice';

/** Same-app paths only — a crafted link must not turn sign-in into an open redirect. */
const safeRealmPath = (candidate: string | undefined): string | null =>
  candidate?.startsWith('/') && !candidate.startsWith('//') && !candidate.startsWith('/\\')
    ? candidate
    : null;

export const Route = createFileRoute('/_focus/sign-in')({
  validateSearch: (search: Record<string, unknown>): { redirect?: string; notice?: SignInNotice } => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
    // A-20's success (task 67.4): the account an invitation became exists, and it signs in here.
    notice: readSignInNotice(search.notice),
  }),
  beforeLoad: async ({ context, search }) => {
    // `null` twice over, and the two mean different things to everyone but this gate: no session,
    // or a probe that could not say. Both leave the form standing, per the docblock above.
    // **The catch is on the probe alone, deliberately.** Widened to a `try` around the redirect it
    // would swallow the redirect too — the defect the router's own guide needs `isRedirect()` to
    // avoid, and one that would silently return this screen to having no gate at all.
    const account = await context.queryClient.ensureQueryData(adminSessionQuery).catch(() => null);
    if (account === null) return;
    // The same exit a completed sign-in takes, rather than a second rule about where an operator
    // belongs — and `?notice=` buys no exemption, since it is in the address anyone can write.
    throw redirect({ to: safeRealmPath(search.redirect) ?? consoleHomeFor(account.role) });
  },
  component: AdminSignInRoute,
});

function AdminSignInRoute() {
  const { redirect: target, notice } = Route.useSearch();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return (
    <SignInScreen
      notice={notice}
      onSignedIn={(account) => {
        // The probe's answer is already in hand — cached, so the realm guard the navigation
        // is about to run asks the api nothing.
        queryClient.setQueryData(ADMIN_SESSION_QUERY_KEY, account);
        void navigate({ to: safeRealmPath(target) ?? consoleHomeFor(account.role) });
      }}
      onRecovered={({ account }) => {
        queryClient.setQueryData(ADMIN_SESSION_QUERY_KEY, account);
        // The count of codes left is not carried: A-19 reads it, and a number of spare credentials
        // has no place in a history entry (`credentials-arrival.ts`).
        void navigate({ to: '/credentials', search: { notice: CREDENTIALS_ARRIVAL.RECOVERED } });
      }}
    />
  );
}
