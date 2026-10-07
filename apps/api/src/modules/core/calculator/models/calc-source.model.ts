import type { OverridingPerson } from '@api/modules/core/disclosure/models/disclosure-value.model';

/**
 * One invoice line of a report's carbon calculator — the working set UX-41 keeps visible and editable (task 38.1;
 * FR-33, UC-32).
 *
 * Not a TypeORM entity (AD-14 constraint 1); instants are `Date`, converted at the DTO boundary (OQ-50); the quantity
 * is a decimal string, never a float (§7.9).
 */

/**
 * What a line says: the figure on the invoice in the unit it reads in, **or** why there is none.
 *
 * Three nullable fields rather than a union, because they are the table's columns and the database's own CHECK is
 * what holds them to one shape or the other — `models` states the shape, `domain/calc-source-check.ts` refuses the
 * wrong one before a write, and the constraint refuses it after.
 */
export interface CalcSourceContents {
  /** The invoice's figure as a decimal string — `500`, `1700.5` — or null where it is not available. */
  readonly quantity: string | null;
  /** The unit it is printed in — a key of the source's units in the factor set — or null with no quantity. */
  readonly unitCode: string | null;
  /** Why there is no figure — "billed by the landlord" — or null where there is one. */
  readonly notAvailableReason: string | null;
}

/**
 * A line's computed tonnes replaced with the reporter's own, and why (task 38.4; UC-34, UX-43) — S-09's *"diesel for
 * the van, your figure"*. Only a measured line has a computed figure to replace, which the table's `CHECK` holds; the
 * computed figure is never discarded, because it is the line's own arithmetic, recomputed whenever it is shown.
 */
export interface CalcLineOverride {
  /** The substituted figure, in tonnes of CO₂-equivalent, as a decimal string. */
  readonly tonnesCo2e: string;
  /** Why it replaces the computed one — printed beside both in the report. */
  readonly explanation: string;
}

/**
 * The monthly form's twelve figures, by position from the period's start month (task 39.1; §12.5.6's task-39 row (1)) —
 * each a decimal string, or `null` for a month left empty. Their sum is the line's quantity, computed by the server;
 * which calendar month each stands for is the period's (`domain/period-months.ts`), and nothing stores it.
 */
export type MonthlyQuantities = readonly (string | null)[];

/** A line's identity: the report it belongs to and the id the client chose for it. */
export interface CalcSourceKey {
  readonly reportId: string;
  readonly sourceId: string;
}

/** Everything a person sets on a line. */
export interface CalcSourceWrite extends CalcSourceKey {
  /** The report's B1 site row it belongs to — its ordinal on the site axis. */
  readonly siteOrdinal: number;
  /** A source of the factor set the report's period resolves — `natural_gas`, `electricity_grid`. */
  readonly sourceKey: string;
  /** The reporter's own name for it — "the van". */
  readonly description: string | null;
  readonly contents: CalcSourceContents;
  /**
   * The twelve month figures the quantity sums, or `null` for a line entered as one figure for the period. **Not part
   * of `contents`**, which is what a run copies: a run retains the quantity either way (the task-38.1 row (3)).
   */
  readonly monthlyQuantities: MonthlyQuantities | null;
  /** The reporter's figure in place of the computed one, or `null` where the computed one stands. */
  readonly override: CalcLineOverride | null;
}

export interface CalcSource extends CalcSourceWrite {
  /**
   * Who replaced the line's tonnes (task 39.4; FR-36) — `null` where nothing is replaced, or for an override made before
   * the person was recorded. On the read shape only: the table's trigger takes it from the request's binding.
   */
  readonly overriddenBy: OverridingPerson | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
