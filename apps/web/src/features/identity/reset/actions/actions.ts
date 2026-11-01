'use server';

import type { RequestPasswordResetRequest, ResetPasswordRequest } from '@easyesg/contracts';
import { API_OUTCOME, mapOutcome } from '@/lib/api-outcome';
import { api } from '@/server/api/api-client';
import { accountStillSignedIn } from '@/server/session/held-account';
import type { RequestResetResult, ResetPasswordResult } from './action-results';

/** S-02 reset request and set-password (FR-6, UC-08). The transport rule is stated once, in `shared/actions/actions.ts`. */
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
  if (outcome.status !== API_OUTCOME.Ok) return outcome;

  // Task 160: "every session" is the reset account's. If this browser held one of them the api has ended
  // it, and it is cleared here so the offered sign-in reaches the form; if the session survived, it is
  // another account's, and the success says so rather than sending a sign-in the gate would turn away.
  return { ...outcome, value: { heldAccount: await accountStillSignedIn() } };
}
