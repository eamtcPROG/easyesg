import type {
  NewReportingEntity,
  ReportingEntity,
  ReportingEntityPatch,
} from '../models/reporting-entity.model';

/**
 * The `core/entity` store — tenant-scoped throughout, so it extends `TenantRepository` and every
 * statement runs on the request's `QueryRunner` (AD-14 constraint 2).
 *
 * **No method takes an organization id**, for `MembershipStore`'s reason: RLS scopes each statement
 * to `app.current_org`, and a parameter would be a second source of tenancy that drifts from the
 * policy the moment either changes. An entity id is a different thing — it names *which* row inside
 * the bound tenant, and RLS makes another tenant's id simply not found.
 */
export interface ReportingEntityStore {
  /** UC-52's list (S-13's Index). Archived entities included — the screen filters, the store does not. */
  listEntities(): Promise<ReportingEntity[]>;

  /** Null when the id is unknown *or* belongs to another tenant, which RLS makes one answer. */
  findEntity(entityId: string): Promise<ReportingEntity | null>;

  create(input: { readonly entity: NewReportingEntity; readonly at: Date }): Promise<ReportingEntity>;

  /**
   * UC-53. Returns the row as it stands afterwards, or null when nothing matched.
   *
   * **The site sync happens inside this call**, not as a second store method the use case
   * orchestrates: it is one save from S-13's point of view, and splitting it would let an entity's
   * name commit while its sites did not. The request transaction makes it atomic; the port makes it
   * one operation so a caller cannot accidentally do half.
   */
  update(input: {
    readonly entityId: string;
    readonly patch: ReportingEntityPatch;
    readonly at: Date;
  }): Promise<ReportingEntity | null>;

  /**
   * UC-55 (FR-20). A status change, never a delete — the entity's reports and exports stay
   * retrievable, which is the whole requirement. False when nothing matched.
   */
  archive(input: { readonly entityId: string; readonly at: Date }): Promise<boolean>;
}

/** DI token beside the interface, so a consumer imports one thing (CLAUDE.md, P-7). */
export const REPORTING_ENTITY_STORE = Symbol('REPORTING_ENTITY_STORE');
