import type { Finding } from '@easyesg/validation';
import type { LegalDate } from '@api/contracts/types/time';
import type { RollUp } from '../models/roll-up.model';
import type { StoredValidation, ValidationRun } from '../models/validation-run.model';

/**
 * A report's validation run and its findings (task 41.2; FR-43). **One run per report, replaced whole**: there is no
 * second, older run a reader could be shown by mistake, and no finding outlives the run that found it.
 */
export interface ValidationStore {
  /** Replaces the report's run and findings; `null` where the report is not visible to the bound tenant. */
  replace(command: {
    readonly reportId: string;
    readonly rulesOn: LegalDate;
    readonly rulesRevision: number;
    readonly findings: readonly Finding[];
    /** What the run's answers and findings come to, per module and for the report (task 41.3). */
    readonly rollUp: RollUp;
  }): Promise<ValidationRun | null>;

  /**
   * The report's last run with its findings in the interpreter's order and its roll-up, or `null` where it was never
   * validated.
   */
  read(query: { readonly reportId: string }): Promise<StoredValidation | null>;
}

export const VALIDATION_STORE = Symbol('VALIDATION_STORE');
