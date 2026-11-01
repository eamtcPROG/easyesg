import { PROBLEM_TYPE } from '@easyesg/contracts';
import { API_OUTCOME, type ApiFailure } from '@/lib/api-outcome';

/**
 * Whether a refused first password left the confirmation's grant unspent, so the action puts it back
 * (task 155; `server/sealed/setup-grant.ts`).
 *
 * **The API spends a grant only by claiming it, and a claim survives only a success.** No answer at all
 * cannot have spent it; a password outside the policy is refused before anything is looked up; a refusal
 * after the claim — the account no longer in setup, or holding a password already — rolls the claim back
 * with its transaction. The one refusal that means the grant is gone is the stale-proof one: the API
 * found no live grant, so there is nothing left to hold, and holding it would only replay the refusal.
 */
export const grantSurvivesRefusal = (failure: ApiFailure): boolean =>
  !(
    failure.status === API_OUTCOME.Problem &&
    failure.problem.type === PROBLEM_TYPE.AccountSetupProofStale
  );
