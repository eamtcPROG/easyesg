'use server';

import type {
  AccountResponse,
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
import { api } from '@/server/api-client';
import { destroySession, establishSession, readSession } from '@/server/session';
import { redirect } from '@/i18n/navigation';
import type {
  AccountSummary,
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
export async function signOutAction(): Promise<void> {
  const session = await readSession();
  if (session) {
    await api.delete<SignOutRequest>('/auth/session', { refreshToken: session.refreshToken });
  }
  await destroySession();
  redirect({ href: '/sign-in', locale: await getLocale() });
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
