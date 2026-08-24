import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { isLocale, toLocale, type Locale } from '@easyesg/i18n';
import { routing } from '@/i18n/routing';
import { REFRESH_COOKIE } from '@/lib/session-cookie';

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
 */
const handleI18nRouting = createMiddleware(routing);

/**
 * First path segment after the locale that does **not** require a session. Route groups carry
 * no URL segment, so `(public)` and `(identity)` are invisible here and the list is explicit.
 *
 * The default is closed: anything not named is authenticated. Adding a public screen means
 * adding it here, which is the direction that fails safe.
 */
const UNAUTHENTICATED_SEGMENTS = new Set([
  // (public) — Phase 10
  'legal',
  'help',
  // (identity) — Phase 2
  'sign-in',
  'register',
  'verify',
  'reset',
  'set-password',
  'invitation',
]);

/**
 * The first segment that is **not** a locale — the route segment, whether or not the URL
 * carries a locale prefix.
 *
 * Reading segment 1 as the locale was correct under `localePrefix: 'always'` and became a
 * security bug the moment it changed to `'as-needed'` (21 Aug 2026): the source locale is
 * served unprefixed, so `/home` splits to `['home']`, the old code read segment 2 as
 * `undefined`, concluded "no route segment, this is the marketing home" and returned public.
 * Every authenticated route in Romanian would have been reachable with no session — failing
 * open, invisibly, on the one branch no test covered because every test URL was prefixed.
 */
function routeSegment(pathname: string): string | undefined {
  const [first, second] = pathname.split('/').filter(Boolean);
  return isLocale(first) ? second : first;
}

/** The locale a path is in — the prefix when there is one, the source locale when there is not
 *  (`localePrefix: 'as-needed'` serves the source locale unprefixed). */
function localeOf(pathname: string): Locale {
  return toLocale(pathname.split('/').filter(Boolean)[0]);
}

/** Prefixes a path for a locale, honouring `as-needed`: the default locale takes no prefix. */
function localePath(locale: Locale, path: string): string {
  return locale === routing.defaultLocale ? path : `/${locale}${path}`;
}

function requiresSession(pathname: string): boolean {
  const segment = routeSegment(pathname);
  if (!segment) return false; // the marketing home, at `/` or `/{locale}`
  return !UNAUTHENTICATED_SEGMENTS.has(segment);
}

export default function proxy(request: NextRequest): NextResponse {
  // Locale first: it may return a redirect (bare path → negotiated locale) or a rewrite, and
  // either way it establishes the locale the sign-in redirect below has to preserve.
  const response = handleI18nRouting(request);

  // A redirect from locale negotiation is terminal — the request will arrive again, resolved.
  if (response.headers.has('location')) return response;

  const { pathname } = request.nextUrl;
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
