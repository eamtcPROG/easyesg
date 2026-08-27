import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import {
  PROBLEM_TYPE,
  SOCIAL_SIGN_IN_INTENT,
  isSocialProvider,
  isSocialSignInIntent,
  type CompleteSocialSignInRequest,
  type SocialChallengeRequest,
  type SocialChallengeResponse,
  type SessionResponse,
  type SocialSignInIntent,
} from '@easyesg/contracts';
import { toLocale, type Locale } from '@easyesg/i18n';
import { holdPendingLink } from '@/server/pending-link';
import { readSession } from '@/server/session';
import { API_OUTCOME } from '@/lib/api-outcome';
import { env } from '@/lib/env';
import { sanitizeReturnPath } from '@/lib/locale-path';
import { resolvePostSignIn } from '@/server/post-sign-in';
import { LOCALE_COOKIE } from '@/lib/session-cookie';
import { getPathname } from '@/i18n/navigation';
import { api } from '@/server/api-client';
import { establishSession } from '@/server/session';
import {
  consumeSocialTransaction,
  persistSocialTransaction,
} from '@/server/social-transaction';
import { SOCIAL_NOTICE, type SocialNotice } from './social';
import { ROUTES } from '@/lib/routes';

/**
 * The web tier's half of the provider flow (task 24, §12.5.6's task-24 flow row) — the two
 * Route Handlers under `/auth/social/{provider}` delegate here, keeping `app/` routes thin.
 *
 * `begin` asks the api for the authorization challenge, seals the transaction cookie and sends
 * the browser to the provider. `complete` consumes the transaction, presents the callback to
 * the api's back channel, and either establishes the session — sealing the OQ-33 cookie exactly
 * as password sign-in does — or lands the user back on S-01 with the one notice each spec
 * branch names. Every failure is a redirect with a notice, never an error page: the person is
 * mid-flow between two screens they know, and S-01 is where every path is recoverable from.
 */

/** The locale for our own redirect targets: the cookie next-intl maintains, or the source. */
function requestLocale(request: NextRequest): Locale {
  return toLocale(request.cookies.get(LOCALE_COOKIE)?.value);
}

const SCREEN = {
  SIGN_IN: ROUTES.SIGN_IN,
  REGISTER: ROUTES.REGISTER,
  /** Where a link flow starts and returns (task 27.7). */
  ACCOUNT_CREDENTIALS: ROUTES.ACCOUNT_CREDENTIALS,
} as const;

type Screen = (typeof SCREEN)[keyof typeof SCREEN];

function noticeRedirect(locale: Locale, screen: Screen, notice: SocialNotice): NextResponse {
  const pathname = getPathname({ locale, href: screen });
  // Based on the PUBLIC origin, never `request.url`: the standalone server binds `0.0.0.0`
  // (playwright.config.ts owns that story), and a redirect built from the bind address sends
  // the browser to a host the session cookie was never set on — signed in and signed out at
  // once, measured rather than imagined (task 24's browser suite caught it).
  return NextResponse.redirect(new URL(`${pathname}?notice=${notice}`, env.publicOrigin), 302);
}

/**
 * The screen a failed flow returns to — where the user started, per the recorded intent.
 *
 * A **link** started on S-28 and returns there (task 27.7): sending a signed-in user to the
 * sign-in page because their provider refused would be telling them their session had ended,
 * which it has not.
 */
const originScreen = (intent: SocialSignInIntent): Screen =>
  intent === SOCIAL_SIGN_IN_INTENT.LINK
    ? SCREEN.ACCOUNT_CREDENTIALS
    : intent === SOCIAL_SIGN_IN_INTENT.REGISTER
      ? SCREEN.REGISTER
      : SCREEN.SIGN_IN;

export async function beginSocialFlow(
  request: NextRequest,
  providerParam: string,
): Promise<NextResponse> {
  const locale = requestLocale(request);
  if (!isSocialProvider(providerParam)) {
    return noticeRedirect(locale, SCREEN.SIGN_IN, SOCIAL_NOTICE.UNAVAILABLE);
  }

  const intentParam = request.nextUrl.searchParams.get('intent') ?? '';
  const requested = isSocialSignInIntent(intentParam) ? intentParam : SOCIAL_SIGN_IN_INTENT.SIGN_IN;

  // **A link is claimed by a parameter and granted by a session** (§12.5.6's task-27.7 row). The
  // intent decides which completion route the callback returns to, so a caller who could assert
  // `link` without one would send an anonymous browser to an authenticated completion — refused
  // there, but only after a provider round trip nobody could act on. Downgrading to sign-in here
  // is the honest answer: with no session, a link is exactly what a sign-in is.
  const intent =
    requested === SOCIAL_SIGN_IN_INTENT.LINK && (await readSession()) === null
      ? SOCIAL_SIGN_IN_INTENT.SIGN_IN
      : requested;
  const returnCandidate = request.nextUrl.searchParams.get('return') ?? undefined;
  const returnPath = sanitizeReturnPath(returnCandidate) ? (returnCandidate ?? null) : null;
  const redirectUri = `${env.publicOrigin}/auth/social/${providerParam}/callback`;

  const outcome = await api.post<SocialChallengeRequest, SocialChallengeResponse>(
    `/auth/social/${providerParam}/challenge`,
    { redirectUri },
  );
  if (outcome.status !== API_OUTCOME.Ok) {
    const unavailable =
      outcome.status === API_OUTCOME.Problem &&
      outcome.problem.type === PROBLEM_TYPE.SocialProviderUnavailable;
    return noticeRedirect(
      locale,
      originScreen(intent),
      unavailable ? SOCIAL_NOTICE.UNAVAILABLE : SOCIAL_NOTICE.FAILED,
    );
  }

  await persistSocialTransaction({
    provider: providerParam,
    intent,
    state: outcome.value.state,
    nonce: outcome.value.nonce,
    codeVerifier: outcome.value.codeVerifier,
    redirectUri,
    returnPath,
  });

  return NextResponse.redirect(outcome.value.authorizationUrl, 302);
}

export async function completeSocialFlow(
  request: NextRequest,
  providerParam: string,
): Promise<NextResponse> {
  const locale = requestLocale(request);
  const transaction = await consumeSocialTransaction();
  if (!transaction || transaction.provider !== providerParam) {
    return noticeRedirect(locale, SCREEN.SIGN_IN, SOCIAL_NOTICE.RESTART);
  }

  const query = request.nextUrl.searchParams;
  if (query.get('error')) {
    // The provider refused or the person changed their mind at its screen. The error code is
    // the provider's vocabulary, not ours — it stays out of the notice and off the screen.
    return noticeRedirect(locale, originScreen(transaction.intent), SOCIAL_NOTICE.CANCELLED);
  }

  const code = query.get('code');
  const state = query.get('state');
  if (!code || !state || state !== transaction.state) {
    return noticeRedirect(locale, SCREEN.SIGN_IN, SOCIAL_NOTICE.RESTART);
  }

  // **A link does not complete here** (task 27.7). FR-8 needs the current password, and it is asked
  // for after the provider returns rather than carried across the redirect — so the callback holds
  // the redeemed values and hands the reader back to S-28's pending state. Nothing is attached
  // until the password is supplied there; abandoning the screen leaves the account exactly as it was.
  if (transaction.intent === SOCIAL_SIGN_IN_INTENT.LINK) {
    await holdPendingLink({
      provider: providerParam,
      code,
      state,
      nonce: transaction.nonce,
      codeVerifier: transaction.codeVerifier,
      redirectUri: transaction.redirectUri,
    });
    return NextResponse.redirect(
      new URL(getPathname({ locale, href: SCREEN.ACCOUNT_CREDENTIALS }), env.publicOrigin),
      302,
    );
  }

  const outcome = await api.post<CompleteSocialSignInRequest, SessionResponse>(
    `/auth/social/${providerParam}/session`,
    {
      code,
      state,
      nonce: transaction.nonce,
      codeVerifier: transaction.codeVerifier,
      redirectUri: transaction.redirectUri,
      intent: transaction.intent,
    },
  );

  if (outcome.status === API_OUTCOME.Ok) {
    const session = await establishSession(outcome.value);
    // §4.3's branch (task 25.4), replacing task 22's recorded `?return=`-or-`/home` interim — a
    // provider session is the same session (UC-05), so it exits through the same decision rather
    // than through a copy of it.
    const target = await resolvePostSignIn(transaction.returnPath ?? undefined);
    const pathname = getPathname({
      locale: target.locale ?? session.account.locale,
      href: target.href,
    });
    return NextResponse.redirect(new URL(pathname, env.publicOrigin), 302);
  }

  if (outcome.status === API_OUTCOME.Problem) {
    switch (outcome.problem.type) {
      case PROBLEM_TYPE.SocialIdentityUnknown:
        // UC-05's alternate flow: land on the register surface, which offers the provider
        // registration the sign-in could not silently perform.
        return noticeRedirect(locale, SCREEN.REGISTER, SOCIAL_NOTICE.UNKNOWN_IDENTITY);
      case PROBLEM_TYPE.SocialEmailInUse:
        return noticeRedirect(locale, SCREEN.SIGN_IN, SOCIAL_NOTICE.EMAIL_IN_USE);
      case PROBLEM_TYPE.EmailUnverified:
        return noticeRedirect(locale, SCREEN.SIGN_IN, SOCIAL_NOTICE.VERIFY_SENT);
      case PROBLEM_TYPE.SocialProviderUnavailable:
        return noticeRedirect(locale, SCREEN.SIGN_IN, SOCIAL_NOTICE.UNAVAILABLE);
      default:
        return noticeRedirect(locale, SCREEN.SIGN_IN, SOCIAL_NOTICE.FAILED);
    }
  }

  return noticeRedirect(locale, SCREEN.SIGN_IN, SOCIAL_NOTICE.FAILED);
}
