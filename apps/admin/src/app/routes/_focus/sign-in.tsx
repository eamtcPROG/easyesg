/**
 * A-01 — Admin sign-in · PA, BO · UC-68 · Focus · Phase 2 (task 23)
 *
 * Elevated sign-in for the administrative realm: email, password, and the mandatory TOTP code
 * (FR-75, NFR-65) — this surface shares no session, cookie scope or credential with the tenant
 * application, and does not accept ordinary tenant credentials. The session it establishes is
 * the sealed httpOnly cookie the api sets (OQ-17), 8 h idle / 12 h absolute (§12.5.6).
 *
 * `?redirect=` is the realm guard's hand-off — the screen the closed-by-default `_realm`
 * boundary turned away. It round-trips the browser, so only a same-app path survives the
 * sanitizer; everything else lands on the console home (whose index route resolves to A-02,
 * the register — §4.3's "console home for the operator's privilege level" refines per role at
 * task 67).
 */
import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useTranslations } from 'use-intl';
import { ADMIN_SESSION_QUERY_KEY } from '~/realm/session';
import { SignInScreen } from '~/realm/sign-in-screen';

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
  const t = useTranslations('realm.signIn');
  const { redirect: target } = Route.useSearch();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return (
    <>
      <h1 className="t-heading-1">{t('title')}</h1>
      <p className="t-body">{t('subtitle')}</p>
      <SignInScreen
        onSignedIn={(account) => {
          // The probe's answer is already in hand — cached, so the realm guard the navigation
          // is about to run asks the api nothing.
          queryClient.setQueryData(ADMIN_SESSION_QUERY_KEY, account);
          void navigate({ to: safeRealmPath(target) ?? '/' });
        }}
      />
    </>
  );
}
