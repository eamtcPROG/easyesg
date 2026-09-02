import { Injectable } from '@nestjs/common';
import type { ReportStore } from '@api/modules/core/disclosure/interfaces/report-store.interface';
import type {
  EntitySnapshot,
  SnapshotConsolidationMember,
  SnapshotSite,
} from '@api/modules/core/disclosure/models/entity-snapshot.model';
import { isConsolidationBasis } from '@api/modules/core/entity/models/reporting-entity.model';
import {
  ReportAlreadyExistsError,
  ReportNotEditableError,
} from '@api/modules/core/disclosure/errors/report.errors';
import type {
  NewReport,
  Report,
  ReportPatch,
  ReportScope,
  ReportStatus,
} from '@api/modules/core/disclosure/models/report.model';
import { returnedRows } from '../returned-rows';
import { SQL_STATE, hasSqlState } from '../sql-state';
import { TenantRepository } from '../tenant-repository';

interface ReportRow {
  id: string;
  reporting_period_id: string;
  scope: ReportScope;
  status: ReportStatus;
  template_version: string;
  taxonomy_version: string;
  created_at: Date;
  updated_at: Date;
  // The subject, joined rather than stored (task 32.2). `::text` on every date column for the
  // reason `reporting-period-store.repository.ts` states at length: the driver maps `date` to a
  // JavaScript `Date`, so `2026-12-31` read in a zone behind UTC comes back as the 30th — NFR-34's
  // exact failure, reintroduced at the boundary meant to uphold it.
  reporting_entity_id: string;
  entity_name: string;
  fiscal_year: number;
  period_start: string;
  period_start_tz: string;
  period_end: string;
  period_end_tz: string;
  due_date: string | null;
  due_date_tz: string | null;
}

/**
 * Qualified with the alias every statement here uses, because one of them joins the period and an
 * unqualified `id` would be ambiguous there. One list rather than two is what keeps the three reads
 * answering the same shape.
 */
const REPORT_COLUMNS = `r.id, r.reporting_period_id, r.scope, r.status,
        r.template_version, r.taxonomy_version, r.created_at, r.updated_at,
        p.reporting_entity_id, e.name AS entity_name, p.fiscal_year,
        p.period_start::text AS period_start, p.period_start_tz,
        p.period_end::text   AS period_end,   p.period_end_tz,
        p.due_date::text     AS due_date,     p.due_date_tz`;

/**
 * **Every read joins the subject, so there is one shape.** A list that carried the entity and a
 * record that did not would make task 32.3's creation flow read one thing and its own record
 * another — and the join is over two tables RLS already scopes, so it raises no tenancy question.
 */
const REPORT_FROM = `FROM core.report r
         JOIN core.reporting_period p ON p.id = r.reporting_period_id
         JOIN core.reporting_entity e ON e.id = p.reporting_entity_id`;

/**
 * **The writes return an id and then re-read.** `REPORT_COLUMNS` now spans three tables, and a
 * `RETURNING` clause can only name the row being written — so the alternative was a second column
 * list for writes, which is exactly the pair that drifts when a column is added to one of them.
 * `reporting-period-store.repository.ts` already re-reads after `open` for its own reason; this is
 * the same move for a stronger one, since it is what makes every path answer one shape.
 */

const toReport = (row: ReportRow): Report => ({
  id: row.id,
  reportingPeriodId: row.reporting_period_id,
  scope: row.scope,
  status: row.status,
  templateVersion: row.template_version,
  taxonomyVersion: row.taxonomy_version,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  subject: {
    reportingEntityId: row.reporting_entity_id,
    entityName: row.entity_name,
    fiscalYear: row.fiscal_year,
    periodStart: { date: row.period_start, timezone: row.period_start_tz },
    periodEnd: { date: row.period_end, timezone: row.period_end_tz },
    dueDate:
      row.due_date !== null && row.due_date_tz !== null
        ? { date: row.due_date, timezone: row.due_date_tz }
        : null,
  },
});

/**
 * The two SQLSTATEs this table answers with a domain error.
 *
 * `23505` is PostgreSQL's own `unique_violation`, raised by the one-report-per-period constraint.
 * `45001` is ours, raised by the lock trigger. Both now come from `../sql-state`, which task 34.1
 * extracted when a third adapter declared its own copy — see that module for why the names had
 * already drifted.
 */
/**
 * **The lock is re-raised from the database even though the use case checks it first**, and that is
 * not redundancy: the application check produces the message, and this is what a caller meets when
 * the period was locked between the read and the write.
 */
/**
 * The snapshot's `payload` is `to_jsonb(row)` over the entity plus its two collections
 * (`reporting-period-store.repository.ts`), so its keys are the columns' — and **which columns
 * depends on when it was taken**: one from before task 29.4 has no `consolidation_basis`. Each
 * reader below tolerates an absent or differently-typed key as *unset* rather than refusing the
 * document, because a snapshot is immutable by grant and there is no correcting it.
 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const stringOrNull = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const strings = (value: unknown): readonly string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
const records = (value: unknown): readonly Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter(isRecord) : [];

const toSite = (row: Record<string, unknown>): SnapshotSite => ({
  name: stringOrNull(row.name) ?? '',
  addressLine1: stringOrNull(row.address_line1),
  locality: stringOrNull(row.locality),
  postalCode: stringOrNull(row.postal_code),
  countryCode: stringOrNull(row.country_code),
  latitude: stringOrNull(row.latitude),
  longitude: stringOrNull(row.longitude),
});

const toMember = (row: Record<string, unknown>): SnapshotConsolidationMember => ({
  name: stringOrNull(row.name) ?? '',
  countryCode: stringOrNull(row.country_code),
});

const toSnapshot = (row: { taken_at: Date; payload: unknown }): EntitySnapshot => {
  const payload = isRecord(row.payload) ? row.payload : {};
  return {
    takenAt: row.taken_at,
    legalForm: stringOrNull(payload.legal_form),
    naceCodes: strings(payload.nace_codes),
    consolidationBasis: isConsolidationBasis(payload.consolidation_basis) ? payload.consolidation_basis : null,
    consolidationMembers: records(payload.consolidation_members).map(toMember),
    sites: records(payload.sites).map(toSite),
  };
};

const translate = (error: unknown): never => {
  if (hasSqlState(error, SQL_STATE.UNIQUE_VIOLATION)) throw new ReportAlreadyExistsError();
  if (hasSqlState(error, SQL_STATE.LOCKED)) throw new ReportNotEditableError();
  throw error;
};

@Injectable()
export class ReportStoreRepository extends TenantRepository<never> implements ReportStore {
  protected readonly entity = 'core.report' as never;

  async entitySnapshotOf(input: { reportId: string }): Promise<EntitySnapshot | null> {
    // Report → period → snapshot, each RLS-scoped; a period that took no snapshot joins nothing,
    // which is the same answer as an unknown report and means the same thing to the caller.
    //
    // **The coordinates are re-rendered as text inside the query.** `to_jsonb` wrote the
    // `numeric(9, 6)` columns as JSON numbers, and the driver's `JSON.parse` would hand them over
    // as doubles — the representation AD-14 constraint 4 keeps out of the application. `->>` reads
    // the jsonb numeric at its stored scale, so `47.383300` crosses the boundary as `47.383300`.
    const rows = await this.manager.query<{ taken_at: Date; payload: unknown }[]>(
      `SELECT s.taken_at,
              s.payload || jsonb_build_object('sites', COALESCE(
                (SELECT jsonb_agg(site || jsonb_build_object(
                          'latitude',  site->>'latitude',
                          'longitude', site->>'longitude'))
                   FROM jsonb_array_elements(s.payload->'sites') AS site),
                '[]'::jsonb)) AS payload
         FROM core.report r
         JOIN core.reporting_period p ON p.id = r.reporting_period_id
         JOIN core.entity_snapshot s ON s.id = p.entity_snapshot_id
        WHERE r.id = $1`,
      [input.reportId],
    );
    const row = rows[0];
    return row === undefined ? null : toSnapshot(row);
  }

  async listReports(input: { reportingEntityId?: string }): Promise<Report[]> {
    // **The join is the entity filter.** A report knows its period and the period knows its entity,
    // so S-06's "this entity's reports" is one hop rather than a column copied onto this table —
    // and copying it would be a third place the entity/period/report chain could disagree. RLS
    // scopes both sides, so the join raises no tenancy question.
    //
    // Ordered by the period's own start rather than by the report's creation: S-06 lists reporting
    // years, and a 2025 report created after the 2026 one still belongs below it.
    const rows = await this.manager.query<ReportRow[]>(
      `SELECT ${REPORT_COLUMNS}
         ${REPORT_FROM}
        WHERE ($1::uuid IS NULL OR p.reporting_entity_id = $1)
        ORDER BY p.period_start DESC, r.id DESC`,
      [input.reportingEntityId ?? null],
    );
    return rows.map(toReport);
  }

  async findReport(input: { reportId: string }): Promise<Report | null> {
    const rows = await this.manager.query<ReportRow[]>(
      `SELECT ${REPORT_COLUMNS} ${REPORT_FROM} WHERE r.id = $1`,
      [input.reportId],
    );
    return rows.length === 0 ? null : toReport(rows[0]);
  }

  /**
   * DR-4's pin, written **from the period's own columns inside the inserting statement**.
   *
   * `INSERT ... SELECT` rather than two values the caller read a moment ago and handed back. That
   * is a race — an adoption registered in between would be read by one and not the other — and,
   * more to the point, a caller holding the two strings is a caller who could substitute them.
   * Neither this signature nor this SQL offers that shape.
   *
   * The `SELECT` also carries the tenancy and the existence check for free: RLS hides another
   * organization's period, so it inserts nothing and the method answers null, which is the same
   * answer an unknown id gets.
   */
  async create(input: { report: NewReport; at: Date }): Promise<Report | null> {
    try {
      const rows = returnedRows<{ id: string }>(
        await this.manager.query(
          `INSERT INTO core.report (
               organization_id, reporting_period_id, scope,
               template_version, taxonomy_version, created_at, updated_at)
           SELECT p.organization_id, p.id, $2, p.template_version, p.taxonomy_version, $3, $3
             FROM core.reporting_period p
            WHERE p.id = $1
        RETURNING id`,
          [input.report.reportingPeriodId, input.report.scope, input.at],
        ),
      );
      return rows[0] ? await this.findReport({ reportId: rows[0].id }) : null;
    } catch (error) {
      return translate(error);
    }
  }

  async update(input: {
    reportId: string;
    patch: ReportPatch;
    at: Date;
  }): Promise<Report | null> {
    if (input.patch.scope === undefined) return this.findReport({ reportId: input.reportId });
    try {
      const rows = returnedRows<{ id: string }>(
        await this.manager.query(
          `UPDATE core.report SET scope = $2, updated_at = $3
            WHERE id = $1
        RETURNING id`,
          [input.reportId, input.patch.scope, input.at],
        ),
      );
      return rows[0] ? await this.findReport({ reportId: rows[0].id }) : null;
    } catch (error) {
      return translate(error);
    }
  }
}
