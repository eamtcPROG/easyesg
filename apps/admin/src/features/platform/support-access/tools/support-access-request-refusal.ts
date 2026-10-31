import { API_OUTCOME, PROBLEM_TYPE, type ApiOutcome } from '@easyesg/contracts';

/**
 * Whether A-07's request was refused for a ticket no support request carries (task 77; §12.5.6's task-77 row (9)) — the
 * one refusal the form says at a field rather than in its callout, since the fix is in that field.
 */
export const isUnknownTicket = (outcome: ApiOutcome<unknown>): boolean =>
  outcome.status === API_OUTCOME.Problem && outcome.problem.type === PROBLEM_TYPE.TicketReferenceUnknown;
