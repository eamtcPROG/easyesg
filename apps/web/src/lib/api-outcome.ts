/**
 * The outcome of one API call, end to end: the seam produces it on the server, a Server Action
 * returns it across the RSC wire, and a client component branches on it.
 *
 * Since task 23 the container, the projection helper and the closed `API_OUTCOME` vocabulary
 * live in `@easyesg/contracts` (`src/outcome.ts` there carries the full docblock): the console
 * became the second consumer, and two copies of the discriminator vocabulary would be the exact
 * defect the closed-vocabulary rule names. This module re-exports rather than vanishing so the
 * app's imports keep their one home (`@/lib/api-outcome`) — call sites did not move, the truth
 * did.
 */
export {
  API_OUTCOME,
  mapOutcome,
  type ApiFailure,
  type ApiOutcome,
  type ApiOutcomeStatus,
  type ListResult,
} from '@easyesg/contracts';
