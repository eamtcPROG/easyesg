'use server';

import type {
  AccountResponse,
  RegisterAccountRequest,
  ResendVerificationEmailRequest,
  VerifyEmailRequest,
} from '@easyesg/contracts';
import { mapOutcome } from '@/lib/api-outcome';
import { api } from '@/server/api-client';
import type {
  AccountSummary,
  RegisterResult,
  ResendResult,
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

export async function verifyEmailAction(token: string): Promise<VerifyResult> {
  const outcome = await api.post<VerifyEmailRequest, AccountResponse>('/auth/verify-email', {
    token,
  });
  return mapOutcome(outcome, toAccountSummary);
}

export async function resendVerificationAction(email: string): Promise<ResendResult> {
  const outcome = await api.post<ResendVerificationEmailRequest, undefined>(
    '/auth/verification-email',
    { email },
  );
  // 202, uniformly and by design (OQ-55): the answer says nothing about whether the address
  // holds an account, and neither may the screen.
  return mapOutcome(outcome, () => null);
}
