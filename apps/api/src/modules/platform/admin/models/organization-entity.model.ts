import type { EntityStatus } from '@api/modules/core/entity/models/reporting-entity.model';

/**
 * A reporting entity of an organization, as A-02's record lists it (task 175; `design_spec.md` §5.2 A-02) — which
 * companies an account reports for, and the IDNO each holds, so support can tell the one a caller names. Master data,
 * never report content (FR-77, D-5).
 */
export interface OrganizationEntity {
  readonly id: string;
  readonly name: string;
  /** Null while the entity records none (FR-16's identifiers are optional until task 40's rule requires one). */
  readonly idno: string | null;
  /** An archived entity is listed too: its IDNO is still how a caller may name the account. */
  readonly status: EntityStatus;
}
