import type { NewReport, Report, ReportPatch } from '../models/report.model';

/**
 * The `core/disclosure` report store — tenant-scoped throughout, so it extends `TenantRepository`
 * and every statement runs on the request's `QueryRunner` (AD-14 constraint 2).
 *
 * **No method takes an organization id**, for `ReportingPeriodStore`'s reason: RLS scopes each
 * statement to `app.current_org`, and a parameter would be a second source of tenancy that drifts
 * from the policy the moment either changes.
 *
 * **No method takes a template or taxonomy version either**, and that absence is DR-4 rather than
 * an omission. The pin is read from the period inside `create`, so there is no shape in which a
 * caller could supply one — and `esg_app` holds no `UPDATE` privilege on either column, so there is
 * no shape in which an implementation could move one afterwards.
 */
export interface ReportStore {
  /**
   * Every report in the bound organization, newest first — S-06's index (UC-17, FR-25).
   *
   * Optionally narrowed to one entity. The filter is on the **entity** rather than on the period
   * because that is the question S-06 asks: a period is one row of an entity's history, and a
   * reader looking at an entity wants all of them.
   */
  listReports(input: { readonly reportingEntityId?: string }): Promise<Report[]>;

  /** Null when the id is unknown *or* belongs to another tenant, which RLS makes one answer. */
  findReport(input: { readonly reportId: string }): Promise<Report | null>;

  /**
   * Create the report for a period, **pinning it from that period's own columns in the inserting
   * statement**.
   *
   * The pin is an `INSERT ... SELECT` from `core.reporting_period` rather than two values the
   * caller read a moment ago and passed back: read-then-write is a race, and more importantly a
   * caller holding the two strings is a caller who could substitute them. Neither the port nor the
   * SQL offers that shape.
   *
   * Returns null when the period is unknown or belongs to another tenant — the same answer RLS
   * gives, so the use case need not distinguish.
   */
  create(input: { readonly report: NewReport; readonly at: Date }): Promise<Report | null>;

  /**
   * Edit the report's scope (FR-177). Returns the row as it stands afterwards, or null when nothing
   * matched.
   *
   * **A locked report refuses this below the application** — the `refuse_locked_write` trigger
   * admits only a `status` change while locked — so the refusal survives the period being locked
   * between the use case's read and this write.
   */
  update(input: {
    readonly reportId: string;
    readonly patch: ReportPatch;
    readonly at: Date;
  }): Promise<Report | null>;
}

/** DI token beside the interface, so a consumer imports one thing (CLAUDE.md, P-7). */
export const REPORT_STORE = Symbol('REPORT_STORE');
