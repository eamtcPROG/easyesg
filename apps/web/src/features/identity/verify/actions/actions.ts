'use server';

import type {
  AccountResponse,
  ResendVerificationEmailRequest,
  VerifyEmailRequest,
} from '@easyesg/contracts';
import { mapOutcome } from '@/lib/api-outcome';
import { api } from '@/server/api/api-client';
import { toAccountSummary } from '../../shared/tools/account-summary';
import type { ResendResult, VerifyResult } from './action-results';

/** S-02 verify and resend (FR-3, UC-02). The transport rule is stated once, in `shared/actions/actions.ts`. */
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
