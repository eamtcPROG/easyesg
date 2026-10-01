import type { CalcSourceContents } from './calc-source.model';
import type { FactorSetPin } from './factor-set.model';

/**
 * A calculation committed, with the inputs it read — P-11's *inputs retained at the run* (task 38.1; FR-35, NFR-19).
 *
 * **Immutable once recorded**: the request tier holds no `UPDATE` or `DELETE` on either table, so a run is the record
 * of what one calculation read, and an edit to a line afterwards changes the working set and never the run.
 */

/** One line as the run read it. */
export interface CalcInput {
  /** The line it was copied from — provenance, since the line may since have changed or gone. */
  readonly sourceId: string;
  readonly siteOrdinal: number;
  readonly sourceKey: string;
  readonly description: string | null;
  readonly contents: CalcSourceContents;
}

export interface CalcRun {
  readonly id: string;
  readonly reportId: string;
  /** FR-35's pin — the factor set the run applies, readable by `FACTOR_SETS.pinned` after it has moved on. */
  readonly factorSet: FactorSetPin;
  readonly recordedAt: Date;
  /** The account that ran it, bound by the request rather than named by it. */
  readonly recordedBy: string | null;
  /** Every line the report held when the run was recorded, in the order the report lists them. */
  readonly inputs: readonly CalcInput[];
}
