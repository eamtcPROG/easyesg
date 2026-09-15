'use server';

import type {
  EmailVerifiedResponse,
  ResendVerificationEmailRequest,
  VerifyEmailRequest,
} from '@easyesg/contracts';
import { API_OUTCOME, mapOutcome } from '@/lib/api-outcome';
import { api } from '@/server/api/api-client';
import { holdSetupGrant } from '@/server/sealed/setup-grant';
import { toAccountSummary } from '../../shared/tools/account-summary';
import type { ResendResult, VerifyResult } from './action-results';

/** S-02 verify and resend (FR-3, UC-02). The transport rule is stated once, in `shared/actions/actions.ts`. */
export interface VerifyEmailCommand extends VerifyEmailRequest {
  /** S-03's invitation, when the registration began there — held with a setup grant (task 155). */
  readonly returnTo?: string;
}

export async function verifyEmailAction(command: VerifyEmailCommand): Promise<VerifyResult> {
  const outcome = await api.post<VerifyEmailRequest, EmailVerifiedResponse>('/auth/verify-email', {
    token: command.token,
  });
  // Task 155 (§12.5.6's task-155 row (4)): an account holding no password is confirmed into setup,
  // and the API answers a grant that opens its password step, with the instant it closes. It is held
  // sealed here with the address it belongs to and never returned to the browser — the summary below
  // carries the status, and the screen goes on to the step where the grant is waiting.
  if (
    outcome.status === API_OUTCOME.Ok &&
    outcome.value.setupGrant !== null &&
    outcome.value.setupGrantExpiresAt !== null
  ) {
    await holdSetupGrant({
      grant: outcome.value.setupGrant,
      email: outcome.value.email,
      expiresAt: outcome.value.setupGrantExpiresAt,
      returnTo: command.returnTo,
    });
  }
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
