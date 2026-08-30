import { Injectable } from '@nestjs/common';
import type { LegalDate } from '@api/contracts/types/time';
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
const PERIOD_COLUMNS = `id, reporting_entity_id, fiscal_year,
        period_start::text  AS period_start, period_start_tz,
        period_end::text    AS period_end,   period_end_tz,
        due_date::text      AS due_date,     due_date_tz,
        template_version, taxonomy_version, prior_period_id, entity_snapshot_id,
        locked_at, locked_by, created_at, updated_at`;

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
const SQL_STATE = { EXCLUSION_VIOLATION: '23P01', PERIOD_LOCKED: '45001' } as const;
type SqlState = (typeof SQL_STATE)[keyof typeof SQL_STATE];

const hasSqlState = (error: unknown, state: SqlState): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === state;

/**
 * Both writes translate the same two refusals, so they translate them the same way.
 *
 * **The lock is re-raised from the database even though the use case checks it first**, and that is
 * not redundancy: the application check produces the message, and this is what a caller meets when
 * the period was locked between the read and the write.
 */
const translate = (error: unknown): never => {
  if (hasSqlState(error, SQL_STATE.EXCLUSION_VIOLATION)) throw new PeriodOverlapsError();
  if (hasSqlState(error, SQL_STATE.PERIOD_LOCKED)) throw new PeriodLockedError();
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

  async listPeriods(input: { reportingEntityId: string }): Promise<ReportingPeriod[]> {
    const rows = await this.manager.query<PeriodRow[]>(
      `SELECT ${PERIOD_COLUMNS} FROM core.reporting_period
        WHERE reporting_entity_id = $1
        ORDER BY period_start DESC, id DESC`,
      [input.reportingEntityId],
    );
    return rows.map(toPeriod);
  }

  async findPeriod(input: { periodId: string }): Promise<ReportingPeriod | null> {
    const rows = await this.manager.query<PeriodRow[]>(
      `SELECT ${PERIOD_COLUMNS} FROM core.reporting_period WHERE id = $1`,
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

    let created: PeriodRow;
    try {
      const rows = await this.manager.query<PeriodRow[]>(
        `INSERT INTO core.reporting_period (
             organization_id, reporting_entity_id, fiscal_year,
             period_start, period_start_tz, period_end, period_end_tz,
             due_date, due_date_tz, template_version, taxonomy_version,
             prior_period_id, entity_snapshot_id, created_at, updated_at)
           VALUES (${this.boundOrganization}, $1, $2, $3::date, $4, $5::date, $6, $7::date, $8, $9, $10,
                   ${this.priorPeriodExpression('$1', '$3::date')}, $11, $12, $12)
        RETURNING ${PERIOD_COLUMNS}`,
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
    // predates that. The period itself is unchanged, but reading it once more is cheaper than a
    // reader having to know which of the two answers is current.
    return (await this.findPeriod({ periodId: created.id })) ?? toPeriod(created);
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

    let updated: PeriodRow | undefined;
    try {
      // `UPDATE ... RETURNING` answers `[rows, count]` where `INSERT` answers rows — normalised by
      // `returnedRows`, whose header explains why that is not remembered per call site.
      updated = returnedRows<PeriodRow>(
        await this.manager.query(
          `UPDATE core.reporting_period SET ${assignments.join(', ')}
            WHERE id = $${values.length}
        RETURNING ${PERIOD_COLUMNS}`,
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
    return (await this.findPeriod({ periodId: updated.id })) ?? toPeriod(updated);
  }

  async lock(input: {
    periodId: string;
    actorId: string | null;
    at: Date;
  }): Promise<ReportingPeriod | null> {
    try {
      const rows = returnedRows<PeriodRow>(
        await this.manager.query(
          `UPDATE core.reporting_period
              SET locked_at = $2, locked_by = $3, updated_at = $2
            WHERE id = $1
        RETURNING ${PERIOD_COLUMNS}`,
          [input.periodId, input.at, input.actorId],
        ),
      );
      return rows[0] ? toPeriod(rows[0]) : null;
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
      const rows = returnedRows<PeriodRow>(
        await this.manager.query(
          `UPDATE core.reporting_period
              SET locked_at = NULL, locked_by = NULL, updated_at = $2
            WHERE id = $1
        RETURNING ${PERIOD_COLUMNS}`,
          [input.periodId, input.at],
        ),
      );
      return rows[0] ? toPeriod(rows[0]) : null;
    } catch (error) {
      return translate(error);
    }
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
  private async relinkSuccessor(period: PeriodRow, at: Date): Promise<void> {
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
  private async relinkOwn(period: PeriodRow, at: Date): Promise<void> {
    await this.manager.query(
      `UPDATE core.reporting_period AS moved
          SET prior_period_id = ${this.priorPeriodExpression('$2', '$3::date')}, updated_at = $4
        WHERE moved.id = $1`,
      [period.id, period.reporting_entity_id, period.period_start, at],
    );
  }
}
