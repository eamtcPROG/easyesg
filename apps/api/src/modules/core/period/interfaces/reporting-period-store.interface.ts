import type {
  NewReportingPeriod,
  ReportingPeriod,
  ReportingPeriodPatch,
} from '../models/reporting-period.model';

/**
 * The `core/period` store — tenant-scoped throughout, so it extends `TenantRepository` and every
 * statement runs on the request's `QueryRunner` (AD-14 constraint 2).
 *
 * **No method takes an organization id**, for `ReportingEntityStore`'s reason: RLS scopes each
 * statement to `app.current_org`, and a parameter would be a second source of tenancy that drifts
 * from the policy the moment either changes.
 */
export interface ReportingPeriodStore {
  /** Every period for one entity, newest first. */
  listPeriods(input: { readonly reportingEntityId: string }): Promise<ReportingPeriod[]>;

  /** Null when the id is unknown *or* belongs to another tenant, which RLS makes one answer. */
  findPeriod(input: { readonly periodId: string }): Promise<ReportingPeriod | null>;

  /**
   * UC-56's write, as **one** operation: insert the period, take the entity snapshot, and repoint
   * the neighbour that should now follow it.
   *
   * **The three are one method rather than three the use case orchestrates**, following the entity
   * store's site sync and for a sharper reason: a period whose snapshot did not commit has lost
   * FR-18's guarantee for that year silently, and a period whose successor was not repointed has
   * lost FR-45's comparative with nothing to show for it. The request transaction makes it atomic;
   * the port makes it one operation so a caller cannot accidentally do half.
   */
  open(input: {
    readonly period: NewReportingPeriod;
    readonly templateVersion: string;
    readonly taxonomyVersion: string;
    readonly at: Date;
  }): Promise<ReportingPeriod>;

  /**
   * Edit the shell's own fields. Returns the row as it stands afterwards, or null when nothing
   * matched. **Relinks as a side effect where the dates moved**, because a period that has been
   * dragged past its neighbour is in exactly the state `open` guards against.
   */
  update(input: {
    readonly periodId: string;
    readonly patch: ReportingPeriodPatch;
    readonly at: Date;
  }): Promise<ReportingPeriod | null>;
}

/** DI token beside the interface, so a consumer imports one thing (CLAUDE.md, P-7). */
export const REPORTING_PERIOD_STORE = Symbol('REPORTING_PERIOD_STORE');
