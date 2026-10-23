import { PROBLEM_TYPE } from '@easyesg/contracts';
import { API_OUTCOME, type ApiOutcome } from './api-outcome';

/**
 * Whether an api answer says the session's account owes an acceptance of the terms or the privacy notice in force
 * (task 195; `architecture.md` §12.5.6's task-195 row (2)) — `AuthGuard`'s `legal-acceptance-required`, by type, since a
 * 403 is also a role refusal.
 *
 * **The api's refusal is the only source of the fact**, deliberately: a release moves a version while sessions are
 * held, so a flag in the sealed cookie would be stale exactly when it matters. The api client asks it of every request
 * that carried the bearer and sends the reader to S-43 (`server/api/api-client.ts`); §4.3's branch asks it of the
 * memberships read it already makes. In `lib/` beside `session-standing.ts`, its sibling for an ended session.
 */
export const outcomeOwesLegalAcceptance = (outcome: ApiOutcome<unknown>): boolean =>
  outcome.status === API_OUTCOME.Problem && outcome.problem.type === PROBLEM_TYPE.LegalAcceptanceRequired;
