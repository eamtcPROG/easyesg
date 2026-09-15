import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { ACCOUNT_STATUS } from '@easyesg/contracts';
import { toLocale, type Locale } from '@easyesg/i18n';
import { routing } from '@/i18n/routing';
import { REFRESH_COOKIE } from '@/lib/session-cookie';
import { completesAccountSetup, issuesSession, requiresSession } from '@/lib/route-access';
import {
  accessTokenIsStale,
  liveSession,
  refreshSession,
  type SessionCookie,
  type SessionJar,
} from '@/server/session/session';
import { completeAccountRoute, ROUTES } from '@/lib/routes';

/**
 * One proxy module, two responsibilities.
 *
 * Next 16 renamed `middleware.ts` to `proxy.ts` and the exported function with it. Next accepts
 * exactly one such module, and both AD-9's session tier and next-intl's locale negotiation need
 * to run here — so they compose rather than compete.
 *
 * AD-9: this tier is a **session-holding proxy**. It holds the httpOnly refresh cookie and
 * forwards requests with a short-lived access token, so no token reaches browser JavaScript.
 * It is emphatically *not* a privileged backend — every route it calls exists in the public
 * OpenAPI surface and is authorized identically (DR-11), and a Next server route reaching the
 * database directly was considered and rejected.
 *
 * **Since task 26.4 it has a third job: rotating the access token on a page load**
 * (architecture.md §12.5.6). The gate below checks that the cookie carries a **live** session —
 * the 7-day idle bound — which says nothing about the ≤15-minute access token inside it. That gap
 * was invisible while every API call came from an action or the `/api/[...path]` pass-through, both
 * of which may write cookies and both of which already rotate. S-16 is the first Server Component
 * to read the API during render, where a cookie write throws, so without this a member returning
 * after twenty minutes met a 401 and an error screen holding a session with six days left on it.
 *
 * **Since task 155, a fourth: an account still completing its setup is sent to S-36** from every
 * address that needs a session but S-36's own (§12.5.6's task-155 row). The API refuses such an
 * account everything but its setup routes, so rendering the address would only draw refusals.
 */
const handleI18nRouting = createMiddleware(routing);

/** The locale a path is in — the prefix when there is one, the source locale when there is not
 *  (`localePrefix: 'as-needed'` serves the source locale unprefixed). */
function localeOf(pathname: string): Locale {
  return toLocale(pathname.split('/').filter(Boolean)[0]);
}

/** Prefixes a path for a locale, honouring `as-needed`: the default locale takes no prefix. */
function localePath(locale: Locale, path: string): string {
  return locale === routing.defaultLocale ? path : `/${locale}${path}`;
}

/**
 * Rotates the session if it is due, and returns the cookie the response must carry.
 *
 * **The `request.cookies` write is the load-bearing half and it must happen before routing.**
 * A cookie set on the *response* reaches the browser and nothing else — the render of this very
 * request would still read the stale token and still be answered 401, so the fix would appear to
 * work while leaving one error screen per rotation. `NextRequest.cookies.set` mutates the
 * underlying `Cookie` header, and next-intl's middleware clones `request.headers` into
 * `NextResponse.next({ request: { headers } })` (read from its source, not assumed) — so the
 * mutation is forwarded downstream and the Server Component reads the rotated token. Reordering
 * this to run after `handleI18nRouting` would silently restore the defect.
 *
 * Only for routes that read the session — the gated ones, and since task 112 the two that issue
 * one. An address that does neither pays nothing, not even an unseal. A failed refresh is not an
 * error here — a dead session falls through to the redirect below, which is the same answer as no
 * cookie at all, and an unreachable API keeps the cookie so a network blip signs nobody out.
 */
const ROTATION = {
  /** A successor was issued. The response must carry it too, so the browser holds it next time. */
  Renewed: 'renewed',
  /** The API judged the session dead. The cookie is gone and the gate below redirects. */
  Ended: 'ended',
} as const;

type RotationOutcome =
  | { readonly kind: typeof ROTATION.Renewed; readonly cookie: SessionCookie }
  | { readonly kind: typeof ROTATION.Ended };

async function rotateIfDue(request: NextRequest): Promise<RotationOutcome | null> {
  const current = liveSession(request.cookies.get(REFRESH_COOKIE)?.value);
  if (!current || !accessTokenIsStale(current)) return null;

  let outcome: RotationOutcome | null = null;
  const jar: SessionJar = {
    write(cookie) {
      outcome = { kind: ROTATION.Renewed, cookie };
      request.cookies.set(cookie.name, cookie.value);
    },
    clear() {
      outcome = { kind: ROTATION.Ended };
      request.cookies.delete(REFRESH_COOKIE);
    },
  };

  await refreshSession({ current, jar });
  return outcome;
}

/** A renewed successor, set on whichever response this request finally answers with. */
function carryRenewal(response: NextResponse, rotated: RotationOutcome | null): void {
  if (rotated?.kind !== ROTATION.Renewed) return;
  const { name, value, ...attributes } = rotated.cookie;
  response.cookies.set(name, value, attributes);
}

export default async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  // **Read before rotation, because rotation may delete it.** A refused refresh clears the cookie
  // from `request.cookies` so the render sees no session, which also erases the fact the gate below
  // needs — *did this request arrive carrying one* — and that is the difference between clearing a
  // dead cookie and sending a `Set-Cookie` to a browser that never had it.
  const presented = request.cookies.get(REFRESH_COOKIE)?.value;
  // **Rotate wherever the request is about to READ the session, which is two sets of routes and
  // not one.** The gated ones have always been here; `/sign-in` and `/register` joined them in
  // task 112, because a signed-in caller landing on either now resolves §4.3's branch during
  // render — and a branch resolved with a sixteen-minute-old access token is answered 401 and
  // reads as *organization unavailable*, which is the wrong screen stated as a fact. An address
  // that does neither still pays nothing, not even an unseal.
  const rotated =
    requiresSession(pathname) || issuesSession(pathname) ? await rotateIfDue(request) : null;

  // Locale first: it may return a redirect (bare path → negotiated locale) or a rewrite, and
  // either way it establishes the locale the sign-in redirect below has to preserve.
  const response = handleI18nRouting(request);
  carryRenewal(response, rotated);
  if (rotated?.kind === ROTATION.Ended) response.cookies.delete(REFRESH_COOKIE);

  // A redirect from locale negotiation is terminal — the request will arrive again, resolved.
  if (response.headers.has('location')) return response;

  // After rotation, so it reads the successor — a status the rotation just learned included.
  const held = liveSession(request.cookies.get(REFRESH_COOKIE)?.value);

  // **`liveSession`, not `cookies.has`** (task 112). The gate and `readSession` are two readings
  // of one fact — *does this request carry a session* — and while this one asked only whether a
  // cookie was present, a value that failed to unseal passed it: the screen rendered
  // authenticated, `api-client` had no token, and the reader met an error state instead of the
  // sign-in that would have fixed it. Failing closed here is what makes the two agree.
  if (requiresSession(pathname) && !held) {
    const signIn = new URL(localePath(localeOf(pathname), ROUTES.SIGN_IN), request.url);
    // UX-38: session expiry returns the user to the exact screen they were on, with queued
    // changes submitted — never to a blank sign-in that loses their place.
    signIn.searchParams.set('return', pathname + request.nextUrl.search);
    const redirected = NextResponse.redirect(signIn);
    // **A cookie the gate just refused is worthless, so stop sending it** — on every path that
    // reaches this redirect, which is the correction task 112's gate review found. `rotateIfDue`
    // clears `request.cookies` when the api refuses a refresh, and the `Ended` branch above clears
    // it on the *i18n* response — the one `return redirected` discards. So the commonest arrival
    // here, a dead session the api judged, was answered with no `Set-Cookie` at all while the test
    // named *"clears the cookie and redirects to sign-in when the refresh is refused"* asserted
    // only the `location`. Keying off `presented` rather than the post-rotation value is what makes
    // all three paths — refused, unsealable, past the refresh bound — clear alike, and still sends
    // nothing to a browser that arrived with no cookie.
    //
    // It matters most for a session the reader declined to keep: that cookie carries no `Max-Age`
    // (OQ-35), so the browser holds it until the tab closes and would present a dead value on every
    // navigation until then.
    if (presented) redirected.cookies.delete(REFRESH_COOKIE);
    return redirected;
  }

  // **Task 155: an account still completing its setup belongs on S-36.** The address it asked for
  // rides along as `?return=`, for the sign-in redirect's UX-38 reason — S-36 hands it to §4.3's
  // branch once the account is active.
  if (
    requiresSession(pathname) &&
    held?.account.status === ACCOUNT_STATUS.AWAITING_SETUP &&
    !completesAccountSetup(pathname)
  ) {
    const setup = new URL(
      localePath(localeOf(pathname), completeAccountRoute(pathname + request.nextUrl.search)),
      request.url,
    );
    const redirected = NextResponse.redirect(setup);
    // **A renewed successor must ride on this redirect too.** The rotation above has already spent
    // the refresh token; a browser left holding it presents a consumed value on its next request,
    // which the API reads as theft past its 30 s grace and answers by revoking the session.
    carryRenewal(redirected, rotated);
    return redirected;
  }

  return response;
}

export const config = {
  /**
   * next-intl's recommended matcher, plus `health` and `auth`.
   *
   * Excluding `api` is not cosmetic: `src/app/api/[...path]` is the token-attaching proxy the
   * browser calls, and a locale rewrite applied to it would corrupt the forwarded path. `health`
   * is the blue/green switch target (§10.6) and must answer identically at every locale — which
   * means at none. `auth` is task 24's OAuth redirect surface (`/auth/social/…`): its paths are
   * registered at the identity providers, so they cannot vary by language, and the provider's
   * callback arrives sessionless by definition — the closed-by-default session gate must not
   * bounce it to sign-in.
   */
  matcher: '/((?!api|auth|health|_next|_vercel|.*\\..*).*)',
};
