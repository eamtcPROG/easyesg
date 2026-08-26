import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { toLocale, type Locale } from '@easyesg/i18n';
import { routing } from '@/i18n/routing';
import { REFRESH_COOKIE } from '@/lib/session-cookie';
import { requiresSession } from '@/lib/route-access';
import { env } from '@/lib/env';
import { unsealSession } from '@/server/session-codec';
import {
  accessTokenIsStale,
  refreshSession,
  type SessionCookie,
  type SessionJar,
} from '@/server/session';

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
 * (architecture.md §12.5.6). The gate below checks that the sealed cookie *exists* — the 7-day
 * idle bound — which says nothing about the ≤15-minute access token inside it. That gap was
 * invisible while every API call came from an action or the `/api/[...path]` pass-through, both
 * of which may write cookies and both of which already rotate. S-16 is the first Server Component
 * to read the API during render, where a cookie write throws, so without this a member returning
 * after twenty minutes met a 401 and an error screen holding a session with six days left on it.
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
 * Only for routes the gate already admits: an anonymous page pays nothing, not even an unseal.
 * A failed refresh is not an error here — a dead session falls through to the redirect below,
 * which is the same answer as no cookie at all, and an unreachable API keeps the cookie so a
 * network blip signs nobody out.
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
  const sealed = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!sealed) return null;

  const current = unsealSession(sealed, env.sessionSecret);
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

export default async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const rotated = requiresSession(pathname) ? await rotateIfDue(request) : null;

  // Locale first: it may return a redirect (bare path → negotiated locale) or a rewrite, and
  // either way it establishes the locale the sign-in redirect below has to preserve.
  const response = handleI18nRouting(request);
  if (rotated?.kind === ROTATION.Renewed) {
    const { name, value, ...attributes } = rotated.cookie;
    response.cookies.set(name, value, attributes);
  }
  if (rotated?.kind === ROTATION.Ended) response.cookies.delete(REFRESH_COOKIE);

  // A redirect from locale negotiation is terminal — the request will arrive again, resolved.
  if (response.headers.has('location')) return response;

  if (requiresSession(pathname) && !request.cookies.has(REFRESH_COOKIE)) {
    const signIn = new URL(localePath(localeOf(pathname), '/sign-in'), request.url);
    // UX-38: session expiry returns the user to the exact screen they were on, with queued
    // changes submitted — never to a blank sign-in that loses their place.
    signIn.searchParams.set('return', pathname + request.nextUrl.search);
    return NextResponse.redirect(signIn);
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
