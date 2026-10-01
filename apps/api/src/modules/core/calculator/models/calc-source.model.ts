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
}

export interface CalcSource extends CalcSourceWrite {
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
