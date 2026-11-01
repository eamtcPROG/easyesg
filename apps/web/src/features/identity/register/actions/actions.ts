'use server';

import type { AccountResponse, RegisterAccountRequest } from '@easyesg/contracts';
import { mapOutcome } from '@/lib/api-outcome';
import { api } from '@/server/api/api-client';
import { toAccountSummary } from '../../shared/tools/account-summary';
import type { RegisterResult } from './action-results';

/** S-01 register (FR-1, UC-01). The transport rule is stated once, in `shared/actions/actions.ts`. */
export async function registerAction(input: RegisterAccountRequest): Promise<RegisterResult> {
  const outcome = await api.post<RegisterAccountRequest, AccountResponse>(
    '/auth/register',
    input,
  );
  return mapOutcome(outcome, toAccountSummary);
}
