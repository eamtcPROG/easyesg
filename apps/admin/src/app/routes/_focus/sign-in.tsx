/**
 * A-01 — Admin sign-in · PA, BO · UC-68 · Focus · Phase 2 (task 23; two-step handshake since
 * the 24 Aug 2026 review)
 *
 * Elevated sign-in for the administrative realm: the credential opens a sealed five-minute
 * challenge, the mandatory TOTP code completes it (FR-75, NFR-65) — this surface shares no
 * session, cookie scope or credential with the tenant application, and does not accept
 * ordinary tenant credentials. The session it establishes is the sealed httpOnly cookie the
 * api sets (OQ-17), 8 h idle / 12 h absolute (§12.5.6). The screen itself — card anatomy,
 * copy, states — is `realm/components/sign-in-screen.tsx`; this route owns only the
 * addressable state: the sanitized `?redirect=` hand-off and the post-sign-in navigation.
 *
 * `?redirect=` is the realm guard's UX-38: the screen the closed-by-default `_realm` boundary
 * turned away. It round-trips the browser, so only a same-app path survives; everything else
 * lands on the console home (whose index resolves to A-02 — §4.3's per-privilege-level home
 * refines at task 67).
 */
import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { ADMIN_SESSION_QUERY_KEY } from '~/realm/session';
import { SignInScreen } from '~/realm/components/sign-in-screen';

/** Same-app paths only — a crafted link must not turn sign-in into an open redirect. */
const safeRealmPath = (candidate: string | undefined): string | null =>
  candidate?.startsWith('/') && !candidate.startsWith('//') && !candidate.startsWith('/\\')
    ? candidate
    : null;

export const Route = createFileRoute('/_focus/sign-in')({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  }),
  component: AdminSignInRoute,
});

function AdminSignInRoute() {
  const { redirect: target } = Route.useSearch();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return (
    <SignInScreen
      onSignedIn={(account) => {
        // The probe's answer is already in hand — cached, so the realm guard the navigation
        // is about to run asks the api nothing.
        queryClient.setQueryData(ADMIN_SESSION_QUERY_KEY, account);
        void navigate({ to: safeRealmPath(target) ?? '/' });
      }}
    />
  );
}
