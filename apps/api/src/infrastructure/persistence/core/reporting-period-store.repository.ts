import { Injectable } from '@nestjs/common';
import type { LegalDate } from '@api/contracts/types/time';
import {
  REPORT_STATUS,
  type ReportStatus,
} from '@api/modules/core/disclosure/models/report.model';
import type { ReportingPeriodStore } from '@api/modules/core/period/interfaces/reporting-period-store.interface';
import {
  PeriodLockedError,
  PeriodOverlapsError,
} from '@api/modules/core/period/errors/period.errors';
import type {
  NewReportingPeriod,
  PeriodReopening,
  ReportingPeriod,
  ReportingPeriodPatch,
} from '@api/modules/core/period/models/reporting-period.model';
import { returnedRows } from '../returned-rows';
import { SQL_STATE, hasSqlState } from '../sql-state';
import { TenantRepository } from '../tenant-repository';

interface PeriodRow {
  id: string;
  reporting_entity_id: string;
  fiscal_year: number;
  period_start: string;
  period_start_tz: string;
  period_end: string;
  period_end_tz: string;
  due_date: string | null;
  due_date_tz: string | null;
  template_version: string;
  taxonomy_version: string;
  prior_period_id: string | null;
  entity_snapshot_id: string | null;
  locked_at: Date | null;
  locked_by: string | null;
  created_at: Date;
  updated_at: Date;
  // The joins (task 32.4). The entity's name completes a reference the row already carries; the
  // report is a LEFT JOIN because a period may legitimately have none — since task 31.3 a report is
  // an explicit creation, and *not started* is FR-23's most important answer rather than an absence.
  entity_name: string;
  report_id: string | null;
  report_status: ReportStatus | null;
  report_updated_at: Date | null;
}

/**
 * What a relink needs, and **named for that rather than being a second copy of the projection**.
 *
 * `PERIOD_COLUMNS` spans three tables since task 32.4, and a `RETURNING` clause can only name the
 * row being written — so the two writes that relink afterwards return this instead. It is not the
 * pair `report-store.repository.ts` warns about: that hazard is two lists trying to be the same
 * projection, and this one is trying to be the four facts `relinkOwn` and `relinkSuccessor` read.
 * Adding a column to the projection has no reason to touch it.
 */
interface RelinkRow {
  id: string;
  reporting_entity_id: string;
  period_start: string;
  period_end: string;
}

interface ReopeningRow {
  id: string;
  locked_at: Date;
  reopened_at: Date;
  reopened_by: string | null;
  reason: string;
}

/**
 * **`::text` on every date column, deliberately.** The driver maps `date` to a JavaScript `Date`,
 * which is an instant — so `2026-12-31` in a zone behind UTC comes back as the 30th, which is the
 * precise failure NFR-34 exists to prevent, reintroduced at the boundary that was supposed to
 * uphold it. Selecting the text keeps the calendar day a calendar day the whole way out.
 */
const PERIOD_COLUMNS = `p.id, p.reporting_entity_id, p.fiscal_year,
        p.period_start::text  AS period_start, p.period_start_tz,
        p.period_end::text    AS period_end,   p.period_end_tz,
        p.due_date::text      AS due_date,     p.due_date_tz,
        p.template_version, p.taxonomy_version, p.prior_period_id, p.entity_snapshot_id,
        p.locked_at, p.locked_by, p.created_at, p.updated_at,
        e.name AS entity_name, r.id AS report_id, r.status AS report_status,
        r.updated_at AS report_updated_at`;

/**
 * **Every read joins the same two tables, so there is one shape** — `report-store.repository.ts`'s
 * rule, and the reason is the same one level down: a list that named the entity and a record that
 * did not would let S-14 and FR-23's overview read one period differently.
 *
 * The report join is `LEFT`, and it multiplies nothing: `report_period_unique` admits at most one
 * report per period, which is the constraint that lets `report` be an object rather than a list.
 * Both tables are RLS-scoped, so the join raises no tenancy question.
 */
const PERIOD_FROM = `FROM core.reporting_period p
         JOIN core.reporting_entity e ON e.id = p.reporting_entity_id
    LEFT JOIN core.report r ON r.reporting_period_id = p.id`;

/** What the two relinking writes return. See `RelinkRow`. */
const RELINK_COLUMNS = `id, reporting_entity_id,
        period_start::text AS period_start, period_end::text AS period_end`;

const toPeriod = (row: PeriodRow): ReportingPeriod => ({
  id: row.id,
  reportingEntityId: row.reporting_entity_id,
  fiscalYear: row.fiscal_year,
  periodStart: { date: row.period_start, timezone: row.period_start_tz },
  periodEnd: { date: row.period_end, timezone: row.period_end_tz },
  dueDate:
    row.due_date !== null && row.due_date_tz !== null
      ? { date: row.due_date, timezone: row.due_date_tz }
      : null,
  templateVersion: row.template_version,
  taxonomyVersion: row.taxonomy_version,
  priorPeriodId: row.prior_period_id,
  entitySnapshotId: row.entity_snapshot_id,
  lockedAt: row.locked_at,
  lockedBy: row.locked_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  entityName: row.entity_name,
  // Both halves or neither — the LEFT JOIN answers two nulls together, and reading `id` alone would
  // make a half-joined report representable in the one place the model says it is not.
  report:
    row.report_id !== null && row.report_status !== null && row.report_updated_at !== null
      ? { id: row.report_id, status: row.report_status, updatedAt: row.report_updated_at }
      : null,
});

/** The columns a patch may name. The two version pins are absent by construction — see the model. */
const PATCHABLE = {
  fiscalYear: 'fiscal_year',
  periodStart: 'period_start',
  periodEnd: 'period_end',
  dueDate: 'due_date',
} as const satisfies Record<keyof ReportingPeriodPatch, string>;

/**
 * The two SQLSTATEs this table answers with a domain error.
 *
 * `23P01` is PostgreSQL's own `exclusion_violation`, raised by the no-overlap constraint. `45001`
 * is ours: class 45 is left to applications by the standard, and the lock trigger raises it so this
 * refusal is distinguishable from every other plpgsql error in the schema — `raise_exception`
 * (P0001) would have made them all look alike.
 */
/**
 * Both writes translate the same two refusals, so they translate them the same way.
 *
 * **The lock is re-raised from the database even though the use case checks it first**, and that is
 * not redundancy: the application check produces the message, and this is what a caller meets when
 * the period was locked between the read and the write.
 */
const translate = (error: unknown): never => {
  if (hasSqlState(error, SQL_STATE.EXCLUSION_VIOLATION)) throw new PeriodOverlapsError();
  if (hasSqlState(error, SQL_STATE.LOCKED)) throw new PeriodLockedError();
  throw error;
};

@Injectable()
export class ReportingPeriodStoreRepository
  extends TenantRepository<never>
  implements ReportingPeriodStore
{
  protected readonly entity = 'core.reporting_period' as never;

  /** §7.6's expression, so the inserts supply exactly what the policies check. */
  private readonly boundOrganization = `NULLIF(current_setting('app.current_org', true), '')::uuid`;

  /**
   * S-14's list, and FR-23's (task 32.4).
   *
   * **Omitting the entity narrows to nothing and that is the whole widening**: RLS already scopes
   * the statement to `app.current_org`, so *every period this caller may see* is exactly the bound
   * organization's — the filter is a screen's question, never the tenancy.
   *
   * The order is unchanged and stays the store's: newest first. FR-23's overview wants soonest
   * deadline first, which is a rule over the data rather than a property of it, so it is applied
   * where the other presentation rules are.
   */
  async listPeriods(input: { reportingEntityId?: string }): Promise<ReportingPeriod[]> {
    const scoped = input.reportingEntityId !== undefined;
    const rows = await this.manager.query<PeriodRow[]>(
      `SELECT ${PERIOD_COLUMNS}
         ${PERIOD_FROM}
        ${scoped ? 'WHERE p.reporting_entity_id = $1' : ''}
        ORDER BY p.period_start DESC, p.id DESC`,
      scoped ? [input.reportingEntityId] : [],
    );
    return rows.map(toPeriod);
  }

  async findPeriod(input: { periodId: string }): Promise<ReportingPeriod | null> {
    const rows = await this.manager.query<PeriodRow[]>(
      `SELECT ${PERIOD_COLUMNS} ${PERIOD_FROM} WHERE p.id = $1`,
      [input.periodId],
    );
    return rows.length === 0 ? null : toPeriod(rows[0]);
  }

  /**
   * UC-56 steps 2, 3 and 4 as one statement sequence on the request transaction.
   *
   * Order matters: the snapshot is taken **before** the period is inserted, because the period
   * references it. Everything commits together or not at all (P-8), so a period can never exist
   * without the master data its report will be read against.
   */
  async open(input: {
    period: NewReportingPeriod;
    templateVersion: string;
    taxonomyVersion: string;
    at: Date;
  }): Promise<ReportingPeriod> {
    const snapshotId = await this.takeEntitySnapshot(input.period.reportingEntityId, input.at);

    // **`RETURNING` names only the row being written**, and `PERIOD_COLUMNS` now spans three
    // tables (task 32.4). So every write below returns what the relink needs and re-reads through
    // `findPeriod`, which is `report-store.repository.ts`'s move and is what keeps one shape.
    let created: RelinkRow;
    try {
      const rows = await this.manager.query<RelinkRow[]>(
        `INSERT INTO core.reporting_period (
             organization_id, reporting_entity_id, fiscal_year,
             period_start, period_start_tz, period_end, period_end_tz,
             due_date, due_date_tz, template_version, taxonomy_version,
             prior_period_id, entity_snapshot_id, created_at, updated_at)
           VALUES (${this.boundOrganization}, $1, $2, $3::date, $4, $5::date, $6, $7::date, $8, $9, $10,
                   ${this.priorPeriodExpression('$1', '$3::date')}, $11, $12, $12)
        RETURNING ${RELINK_COLUMNS}`,
        [
          input.period.reportingEntityId,
          input.period.fiscalYear,
          input.period.periodStart.date,
          input.period.periodStart.timezone,
          input.period.periodEnd.date,
          input.period.periodEnd.timezone,
          input.period.dueDate?.date ?? null,
          input.period.dueDate?.timezone ?? null,
          input.templateVersion,
          input.taxonomyVersion,
          snapshotId,
          input.at,
        ],
      );
      created = rows[0];
    } catch (error) {
      return translate(error);
    }

    await this.relinkSuccessor(created, input.at);
    // Re-read: `relinkSuccessor` may have moved this row's own successor, and the RETURNING above
    // predates that — and since task 32.4 it is also the only place the entity's name and the
    // period's report are resolved. **No fallback**: a period that was just inserted on this
    // transaction and cannot be read back is a broken invariant, not a degraded answer, and the
    // former `?? toPeriod(created)` would now be an un-joined row wearing the joined type.
    const period = await this.findPeriod({ periodId: created.id });
    if (period === null) throw new Error(`Period ${created.id} was inserted and could not be read.`);
    return period;
  }

  async update(input: {
    periodId: string;
    patch: ReportingPeriodPatch;
    at: Date;
  }): Promise<ReportingPeriod | null> {
    const assignments: string[] = [];
    const values: unknown[] = [];
    for (const [field, column] of Object.entries(PATCHABLE)) {
      const value = input.patch[field as keyof ReportingPeriodPatch];
      if (value === undefined) continue;
      if (column === PATCHABLE.fiscalYear) {
        values.push(value);
        assignments.push(`${column} = $${values.length}`);
        continue;
      }
      // A legal date is two columns and they move together — the paired-null CHECK is what makes a
      // half-applied patch unrepresentable rather than merely unlikely.
      const legal = value as LegalDate | null;
      values.push(legal?.date ?? null);
      assignments.push(`${column} = $${values.length}::date`);
      values.push(legal?.timezone ?? null);
      assignments.push(`${column}_tz = $${values.length}`);
    }
    if (assignments.length === 0) return this.findPeriod({ periodId: input.periodId });

    values.push(input.at);
    assignments.push(`updated_at = $${values.length}`);
    values.push(input.periodId);

    let updated: RelinkRow | undefined;
    try {
      // `UPDATE ... RETURNING` answers `[rows, count]` where `INSERT` answers rows — normalised by
      // `returnedRows`, whose header explains why that is not remembered per call site.
      updated = returnedRows<RelinkRow>(
        await this.manager.query(
          `UPDATE core.reporting_period SET ${assignments.join(', ')}
            WHERE id = $${values.length}
        RETURNING ${RELINK_COLUMNS}`,
          values,
        ),
      )[0];
    } catch (error) {
      return translate(error);
    }
    if (!updated) return null;

    // Dates may have moved, so this period's own prior link and its successor's are both stale.
    if (input.patch.periodStart !== undefined || input.patch.periodEnd !== undefined) {
      await this.relinkOwn(updated, input.at);
      await this.relinkSuccessor(updated, input.at);
    }
    return this.findPeriod({ periodId: updated.id });
  }

  async lock(input: {
    periodId: string;
    actorId: string | null;
    at: Date;
  }): Promise<ReportingPeriod | null> {
    try {
      const rows = returnedRows<{ id: string }>(
        await this.manager.query(
          `UPDATE core.reporting_period
              SET locked_at = $2, locked_by = $3, updated_at = $2
            WHERE id = $1
        RETURNING id`,
          [input.periodId, input.at, input.actorId],
        ),
      );
      if (!rows[0]) return null;
      await this.moveReportStatus(input.periodId, REPORT_STATUS.LOCKED, input.at);
      // Re-read **after** the status move, not before: the report the period now carries is
      // `locked`, and answering the image from before it would report a locked period holding an
      // open report — the exact disagreement `moveReportStatus` exists to prevent.
      return this.findPeriod({ periodId: input.periodId });
    } catch (error) {
      return translate(error);
    }
  }

  /**
   * UC-58 as one statement sequence on the request transaction: record the amendment, then clear
   * the lock.
   *
   * **The record is written first, and the order is the guarantee.** Both commit together or
   * neither does (P-8), but writing the record first means the only way to reach the unlock is
   * through a row that already states who reopened and why — there is no ordering in which the lock
   * is gone and the reason was never captured.
   *
   * `locked_at` is copied from the period rather than passed in, so the record states the lock it
   * actually ended rather than one the caller believed was in force.
   */
  async reopen(input: {
    periodId: string;
    reason: string;
    actorId: string | null;
    at: Date;
  }): Promise<ReportingPeriod | null> {
    const recorded = returnedRows<{ id: string }>(
      await this.manager.query(
        `INSERT INTO core.period_reopening
             (organization_id, reporting_period_id, locked_at, reopened_at, reopened_by, reason)
         SELECT p.organization_id, p.id, p.locked_at, $2, $3, $4
           FROM core.reporting_period p
          WHERE p.id = $1 AND p.locked_at IS NOT NULL
      RETURNING id`,
        [input.periodId, input.at, input.actorId, input.reason],
      ),
    );
    // No row selected means the period is gone or is not locked. Answering null rather than
    // clearing a lock that was not there keeps the record and the state in step.
    if (recorded.length === 0) return null;

    try {
      const rows = returnedRows<{ id: string }>(
        await this.manager.query(
          `UPDATE core.reporting_period
              SET locked_at = NULL, locked_by = NULL, updated_at = $2
            WHERE id = $1
        RETURNING id`,
          [input.periodId, input.at],
        ),
      );
      if (!rows[0]) return null;
      await this.moveReportStatus(input.periodId, REPORT_STATUS.OPEN, input.at);
      // After the status move, for `lock`'s reason in the other direction.
      return this.findPeriod({ periodId: input.periodId });
    } catch (error) {
      return translate(error);
    }
  }

  /**
   * **The period lock is the only writer of a report's `open` and `locked`** (§12.5.6's task-31.3
   * row), and this is that writer.
   *
   * Task 31.3 stores the lifecycle on `core.report` because the four states the product needs
   * include two — ready to file, and filed — that no lock can express. The accepted cost is that
   * `open` and `locked` are then true in two places, and the way that cost is paid is here: every
   * report inside the period moves in the **same transaction** as the lock, so the two cannot
   * disagree. Nothing else in the codebase may write those two values.
   *
   * It lives in this repository rather than in the report's, and rather than in the lock use case
   * calling both, for `open`'s reason: a period whose reports did not move is a period whose lock
   * is a lie, and the port makes the pair one operation so a caller cannot accidentally do half.
   *
   * The report's own `refuse_locked_write` trigger admits this write, and only this write, while a
   * report is locked — the row comparison it makes ignores `status` and `updated_at` alone.
   *
   * **It moves every report in the period unconditionally**, which is right while `open` and
   * `locked` are the only reachable states and is a question the moment they are not: task 41.3's
   * `ready_to_file` and task 47's `filed` each have to say what a lock does to them, and each owns
   * that answer. Guessing one here would be a policy nobody asked for, on a state nothing can
   * currently produce.
   */
  private async moveReportStatus(
    periodId: string,
    status: ReportStatus,
    at: Date,
  ): Promise<void> {
    await this.manager.query(
      `UPDATE core.report SET status = $2, updated_at = $3
        WHERE reporting_period_id = $1 AND status IS DISTINCT FROM $2`,
      [periodId, status, at],
    );
  }

  async listReopenings(input: { periodId: string }): Promise<PeriodReopening[]> {
    const rows = await this.manager.query<ReopeningRow[]>(
      `SELECT id, locked_at, reopened_at, reopened_by, reason
         FROM core.period_reopening
        WHERE reporting_period_id = $1
        ORDER BY reopened_at DESC, id DESC`,
      [input.periodId],
    );
    return rows.map((row) => ({
      id: row.id,
      lockedAt: row.locked_at,
      reopenedAt: row.reopened_at,
      reopenedBy: row.reopened_by,
      reason: row.reason,
    }));
  }

  /**
   * FR-18's point-in-time master data, taken at period open (§7.2).
   *
   * **The payload is assembled in SQL rather than read into the application and written back**, so
   * the snapshot is a consistent read of the same transaction — and so nothing between here and the
   * store can reshape it. `to_jsonb` over the row plus its two collections is the whole document.
   */
  private async takeEntitySnapshot(reportingEntityId: string, at: Date): Promise<string | null> {
    const rows = await this.manager.query<{ id: string }[]>(
      `INSERT INTO core.entity_snapshot (organization_id, reporting_entity_id, taken_at, payload)
       SELECT e.organization_id, e.id, $2, to_jsonb(e) || jsonb_build_object(
                'sites', COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.name, s.id)
                                     FROM core.site s
                                    WHERE s.reporting_entity_id = e.id), '[]'::jsonb),
                'consolidation_members',
                  COALESCE((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.name, m.id)
                              FROM core.consolidation_member m
                             WHERE m.reporting_entity_id = e.id), '[]'::jsonb))
         FROM core.reporting_entity e
        WHERE e.id = $1
      RETURNING id`,
      [reportingEntityId, at],
    );
    return rows[0]?.id ?? null;
  }

  /**
   * The period immediately preceding `entity`'s period starting on `start`, as a scalar subquery.
   *
   * Written as SQL rather than resolved in the application because it has to be evaluated *inside*
   * the inserting statement: a separate `SELECT` then `INSERT` is a race two administrators opening
   * adjacent years can lose, and the answer would be stale by the time it was written.
   */
  private priorPeriodExpression(entity: string, start: string): string {
    return `(SELECT p.id FROM core.reporting_period p
              WHERE p.reporting_entity_id = ${entity} AND p.period_end < ${start}
              ORDER BY p.period_end DESC LIMIT 1)`;
  }

  /**
   * Repoint whichever period should now follow `period` — the maintenance half of §12.5.6's
   * task-31.1 linkage row.
   *
   * Without it, opening FY2026 before backfilling FY2025 leaves FY2026's prior null **forever**, so
   * D-3's comparatives are silently absent in the second reporting year with nothing failing.
   */
  private async relinkSuccessor(period: RelinkRow, at: Date): Promise<void> {
    await this.manager.query(
      `UPDATE core.reporting_period AS successor
          SET prior_period_id = $1, updated_at = $3
        WHERE successor.reporting_entity_id = $2
          AND successor.period_start > $4::date
          AND successor.id <> $1
          AND successor.id = (SELECT p.id FROM core.reporting_period p
                               WHERE p.reporting_entity_id = $2 AND p.period_start > $4::date
                               ORDER BY p.period_start ASC LIMIT 1)
          AND successor.prior_period_id IS DISTINCT FROM $1`,
      [period.id, period.reporting_entity_id, at, period.period_end],
    );
  }

  /** The same maintenance for the moved period's own link, after an edit shifted its dates. */
  private async relinkOwn(period: RelinkRow, at: Date): Promise<void> {
    await this.manager.query(
      `UPDATE core.reporting_period AS moved
          SET prior_period_id = ${this.priorPeriodExpression('$2', '$3::date')}, updated_at = $4
        WHERE moved.id = $1`,
      [period.id, period.reporting_entity_id, period.period_start, at],
    );
  }
}
