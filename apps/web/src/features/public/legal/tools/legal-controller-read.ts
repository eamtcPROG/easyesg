import { API_OUTCOME, PROBLEM_TYPE, type ApiOutcome, type LegalControllerResponse } from '@easyesg/contracts';

/**
 * What the read of the platform operator means for a document that names it (task 75; FR-205 AC-13), as three arms.
 * **None in force is not a failed read**: the api says so with its own problem type, and the document answers *not yet
 * available* (task 103) — the task-75 row (7)'s rule that nothing naming a missing controller goes live. Any other
 * failure is the archetype's *error — recoverable*, the frame kept and a callout in the text's place.
 */
export const LEGAL_CONTROLLER_READ = {
  READY: 'ready',
  NONE_IN_FORCE: 'none_in_force',
  FAILED: 'failed',
} as const;

export type LegalControllerRead =
  | { readonly kind: typeof LEGAL_CONTROLLER_READ.READY; readonly controller: LegalControllerResponse }
  | { readonly kind: typeof LEGAL_CONTROLLER_READ.NONE_IN_FORCE }
  | { readonly kind: typeof LEGAL_CONTROLLER_READ.FAILED };

export const readLegalControllerOutcome = (outcome: ApiOutcome<LegalControllerResponse>): LegalControllerRead => {
  if (outcome.status === API_OUTCOME.Ok) return { kind: LEGAL_CONTROLLER_READ.READY, controller: outcome.value };
  if (outcome.status === API_OUTCOME.Problem && outcome.problem.type === PROBLEM_TYPE.LegalControllerUnavailable) {
    return { kind: LEGAL_CONTROLLER_READ.NONE_IN_FORCE };
  }
  return { kind: LEGAL_CONTROLLER_READ.FAILED };
};
