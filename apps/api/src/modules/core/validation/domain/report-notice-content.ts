import { COMPLETION_STATUS, completionStatus, type Counts, type RollUp } from '../models/roll-up.model';

/**
 * What a check's run says to the two notices (task 51.2; FR-164, FR-165) — read from the roll-up the run stored, the
 * named list FR-164 says is already computed (UC-169).
 */

/** The outstanding fields by module, in the standard's order, each element once — FR-164's *specific modules and fields*. */
export function outstandingByModule(
  rollUp: RollUp,
): readonly { readonly module: string; readonly elementKeys: readonly string[] }[] {
  return rollUp.modules
    .filter((module) => module.outstandingFields.length > 0)
    .map((module) => ({
      module: module.module,
      elementKeys: [...new Set(module.outstandingFields.map((field) => field.elementKey))],
    }));
}

/** FR-165's *complete and validated* (BR-NOT-4): what the report reads as ready to file, 41.3's test. */
export const isReadyToFile = (counts: Counts): boolean => completionStatus(counts) === COMPLETION_STATUS.COMPLETE;

/** Whether anything has been answered at all — the deadline notice's *not started yet*. */
export const hasStarted = (counts: Counts): boolean => completionStatus(counts) !== COMPLETION_STATUS.NOT_STARTED;
