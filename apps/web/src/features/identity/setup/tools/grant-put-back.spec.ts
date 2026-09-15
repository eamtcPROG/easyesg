import { PROBLEM_TYPE } from '@easyesg/contracts';
import { describe, expect, it } from 'vitest';
import { API_OUTCOME, type ApiFailure } from '@/lib/api-outcome';
import { grantSurvivesRefusal } from './grant-put-back';

/**
 * Which refusals leave the confirmation's grant worth holding again (task 155). Each case is an answer
 * `POST /auth/account-setup/password` can give, and what it means for the claim; the api's
 * `set-first-password-by-grant.use-case.spec.ts` pins the other half — that the refusals after the
 * claim leave the grant unspent.
 */
const refusal = (type: string, status: number): ApiFailure => ({
  status: API_OUTCOME.Problem,
  problem: { type, status },
});

describe('grantSurvivesRefusal (task 155)', () => {
  it('keeps a grant the API never answered about', () => {
    expect(grantSurvivesRefusal({ status: API_OUTCOME.Unreachable })).toBe(true);
  });

  it('keeps a grant after a password the policy refused, which is refused before any look-up', () => {
    expect(grantSurvivesRefusal(refusal('https://easyesg.md/problems/validation-failed', 400))).toBe(true);
  });

  it('keeps a grant after a refusal its claim was rolled back with', () => {
    expect(grantSurvivesRefusal(refusal('https://easyesg.md/problems/conflict', 409))).toBe(true);
  });

  it('drops a grant the API found no live grant for', () => {
    expect(grantSurvivesRefusal(refusal(PROBLEM_TYPE.AccountSetupProofStale, 403))).toBe(false);
  });
});
