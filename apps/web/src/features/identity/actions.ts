'use server';

import type {
  AcceptedInvitation,
  AccountResponse,
  InvitationPreview,
  InvitationTokenRequest,
  RegisterAccountRequest,
  RequestPasswordResetRequest,
  ResendVerificationEmailRequest,
  ResetPasswordRequest,
  SessionResponse,
  SignInRequest,
  SignOutRequest,
  VerifyEmailRequest,
} from '@easyesg/contracts';
import { getLocale } from 'next-intl/server';
import { API_OUTCOME, mapOutcome } from '@/lib/api-outcome';
import { resolvePostSignIn } from '@/server/post-sign-in';
import { POST_SIGN_IN } from './post-sign-in';
import { api } from '@/server/api-client';
import { destroySession, establishSession, readSession } from '@/server/session';
import { redirect } from '@/i18n/navigation';
import { sanitizeReturnPath } from '@/lib/locale-path';
import type {
  AcceptInvitationFailure,
  AccountSummary,
  InvitationPreviewResult,
  RegisterResult,
  RequestResetResult,
  ResetPasswordResult,
  ResendResult,
  SignInFailure,
  VerifyResult,
} from './types/action-results';

/**
 * Server Actions for S-01/S-02 — the decided transport for unauthenticated identity calls
 * (task 20): the browser posts to the Next server tier, which calls the public API as the
 * ordinary client AD-9 says it is. The `/api/[...path]` pass-through stays scoped to traffic
 * that cannot go through this tier (wizard PATCH, offline drain, polls) and is task 22's to
 * wire, together with the session.
 *
 * An action is a projection and nothing more: the `api` client owns the wire conventions AND
 * the ambient context (the locale rides `Accept-Language` from inside the seam), `mapOutcome` owns
 * the failure passthrough, and what remains here is the one per-endpoint fact — which members
 * of the wire DTO the screen needs. The API stays authoritative for every rule; the password
 * policy is checked client-side for UX-108's at-entry feedback, but a bypassed form still
 * meets the same policy as a 400 here.
 */
const toAccountSummary = ({ id, email, status }: AccountResponse): AccountSummary => ({
  id,
  email,
  status,
});

export async function registerAction(input: RegisterAccountRequest): Promise<RegisterResult> {
  const outcome = await api.post<RegisterAccountRequest, AccountResponse>(
    '/auth/register',
    input,
  );
  return mapOutcome(outcome, toAccountSummary);
}

export async function verifyEmailAction(input: VerifyEmailRequest): Promise<VerifyResult> {
  const outcome = await api.post<VerifyEmailRequest, AccountResponse>('/auth/verify-email', input);
  return mapOutcome(outcome, toAccountSummary);
}

export async function resendVerificationAction(
  input: ResendVerificationEmailRequest,
): Promise<ResendResult> {
  const outcome = await api.post<ResendVerificationEmailRequest, undefined>(
    '/auth/verification-email',
    input,
  );
  // 202, uniformly and by design (OQ-55): the answer says nothing about whether the address
  // holds an account, and neither may the screen.
  return mapOutcome(outcome, () => null);
}

/** `returnTo` is `proxy.ts`'s `?return=` value, carried through the screen — sanitized here
 *  because it round-trips through the browser and is therefore attacker-shapeable. */
export interface SignInCommand {
  email: string;
  password: string;
  returnTo?: string;
}

/**
 * S-01 sign-in (FR-4, UC-04) — the only action that ends in a redirect rather than a result,
 * because success ends the SCREEN: the session cookie is set, the locale cookie follows the
 * profile preference (OQ-32), and the user lands where they were headed. Only failures return
 * — the type says so (`SignInFailure`, not an outcome), and the client sees `undefined` when
 * the redirect won.
 *
 * A `?return=` path keeps its own locale (OQ-32: the URL is authoritative for rendering — a
 * session that expired on `/en/reports` resumes in English whatever the profile says); the
 * profile preference decides only when there was nowhere to return to — which, since task 25.4,
 * includes every case where the branch overrode the return path.
 */
export async function signInAction(command: SignInCommand): Promise<SignInFailure> {
  const outcome = await api.post<SignInRequest, SessionResponse>('/auth/session', {
    email: command.email,
    password: command.password,
  });
  if (outcome.status !== API_OUTCOME.Ok) return outcome;

  const session = await establishSession(outcome.value);
  // §4.3's branch, over the memberships the session can now read (task 25.4). It replaces the
  // recorded interim that landed every sign-in on `/home`, and it decides the `?return=` question
  // too: a deep link is honoured only where an organization resolves.
  const target = await resolvePostSignIn(command.returnTo);
  // An unprefixed return path IS the source locale's form (`localePrefix: 'as-needed'`); a
  // branch destination has no locale of its own, so the profile preference decides (OQ-32).
  redirect({ href: target.href, locale: target.locale ?? session.account.locale });
}

/**
 * FR-5, UC-06. The API call authenticates by the refresh token itself (task 21: possession is
 * the proof, and it works after the access token expired). The cookie is cleared whatever the
 * API answered: the person asked to leave THIS browser, and refusing because of a network blip
 * would strand them signed in; a termination the API never heard leaves a row its idle and
 * absolute lifetimes still bound (OQ-35).
 */
export async function signOutAction(returnTo?: string): Promise<void> {
  const session = await readSession();
  if (session) {
    await api.delete<SignOutRequest>('/auth/session', { refreshToken: session.refreshToken });
  }
  await destroySession();

  // `returnTo` is S-03's permission state (task 26.3): someone opened an invitation while signed
  // in as a different address, and the way out is to sign out and come back to THIS invitation
  // rather than to a generic sign-in that loses the link. Sanitised like every other return path,
  // because it reaches this action through the browser and an unchecked one turns sign-out into an
  // open redirect — `proxy.ts` writes its own and this is the second writer.
  const back = sanitizeReturnPath(returnTo);
  const href = back ? `/sign-in?return=${encodeURIComponent(back.href)}` : '/sign-in';
  redirect({ href, locale: back?.locale ?? (await getLocale()) });
}

export async function requestPasswordResetAction(
  input: RequestPasswordResetRequest,
): Promise<RequestResetResult> {
  const outcome = await api.post<RequestPasswordResetRequest, undefined>(
    '/auth/password-reset-email',
    input,
  );
  // 202, identical whether or not the address is registered (UC-08, NFR-64) — the screen's
  // confirmation states the same conditional fact and no more.
  return mapOutcome(outcome, () => null);
}

export async function resetPasswordAction(input: ResetPasswordRequest): Promise<ResetPasswordResult> {
  const outcome = await api.post<ResetPasswordRequest, undefined>('/auth/password-reset', input);
  // No redirect: S-02's exit to S-01 is the success state's OFFERED next step, after the
  // screen has stated what consuming the link just did (every session signed out, FR-6/P5).
  return mapOutcome(outcome, () => null);
}

/**
 * S-03's opening read (UC-15) — what the invitation offers, before anything is used.
 *
 * **The token goes in a POST body, not a URL**, which is the API's shape for all three token kinds
 * and the reason a mail scanner prefetching the link cannot burn it: nothing is consumed on render,
 * here or on the server.
 *
 * An unusable link comes back as `Ok` carrying a `standing`, not as a problem — S-03 draws expired,
 * already-used, revoked and not-found as four distinguishable recoverable states, so the screen has
 * to branch on a value rather than on prose. Only transport failures reach the `Problem` and
 * `Unreachable` arms.
 */
export async function previewInvitationAction(
  input: InvitationTokenRequest,
): Promise<InvitationPreviewResult> {
  const outcome = await api.post<InvitationTokenRequest, InvitationPreview>(
    '/invitations/preview',
    input,
  );
  return mapOutcome(outcome, (preview) => preview);
}

/**
 * UC-15's acceptance (FR-11), and the exit S-03 promises: **S-05 in the newly joined
 * organization**.
 *
 * No `?return=` and no branch: unlike sign-in, this call has already decided where the user
 * belongs, and the API pointed the session at that organization inside the same transaction
 * (`architecture.md` §12.5.6's task-26.2 row). So the redirect is unconditional, and `/home`
 * resolves to the organization just joined without this tier knowing which it was.
 *
 * `postSignInTarget` is deliberately NOT consulted. Its job is to choose among none / one /
 * several, and none of those questions is open here — the answer is the organization on the
 * invitation, chosen by the person who clicked.
 */
export async function acceptInvitationAction(
  input: InvitationTokenRequest,
): Promise<AcceptInvitationFailure> {
  const outcome = await api.post<InvitationTokenRequest, AcceptedInvitation>(
    '/invitations/acceptance',
    input,
  );
  if (outcome.status !== API_OUTCOME.Ok) return outcome;

  redirect({ href: POST_SIGN_IN.HOME, locale: await getLocale() });
}
