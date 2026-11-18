import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource, QueryRunner } from 'typeorm';
import { REPORT_STATUS } from '@api/modules/core/disclosure/models/report.model';
import { isReportMigrationStatus, type ReportMigrationStatus } from '@api/contracts/report-migration';
import { writeOutboxEvent } from '@api/infrastructure/outbox/outbox-writer';
import {
  TAXONOMY_MIGRATION_RUN_REQUESTED,
  TAXONOMY_MIGRATION_RUN_REVERTED,
} from '@api/modules/platform/taxonomy/constants/taxonomy.constants';
import { pendingOf, tallyOf } from '@api/modules/platform/taxonomy/domain/migration-run';
import { COMPATIBILITY, type Compatibility } from '@api/modules/platform/taxonomy/domain/version-mapping';
import type {
  MigrationRunStore,
  MigrationSelection,
} from '@api/modules/platform/taxonomy/interfaces/migration-run-store.interface';
import type {
  MigrationRunDetail,
  MigrationRunOrganization,
  MigrationRunSummary,
} from '@api/modules/platform/taxonomy/models/migration-run.model';
import { ACQUISITION_PURPOSE } from '@api/modules/platform/support-access/models/support-access-log.model';
import { AdminReadOnly } from '../admin-readonly';
import { collated } from '../collation';
import { CORE_DATA_SOURCE } from '../data-source';

/** The console lists the latest runs; a run is a deliberate act, and fifty is more than a year of them. */
const LISTED = 50;

/**
 * `MIGRATION_RUN_STORE` (task 67.23; §12.5.6's task-67.23 row). **The reads are `esg_admin_ro`'s**, logged first under
 * `taxonomy_exposure` — a run's selection and progress cross every organization, which only a bypass reads — and they
 * read a report's pin, its standing and its organization, never a value (D-5). `esg_admin_ro` bypasses row security,
 * so a deleted report is filtered here, task 192's note. **The writes are `esg_app`'s**, each with its job on the same
 * transaction (P-8): a run recorded is a run queued, and a reversion marked is a reversion queued.
 */
@Injectable()
export class MigrationRunStoreRepository implements MigrationRunStore {
  constructor(
    @InjectDataSource(CORE_DATA_SOURCE) private readonly dataSource: DataSource,
    private readonly adminReadOnly: AdminReadOnly,
  ) {}

  select(input: {
    readonly from: string;
    readonly organizationIds: readonly string[] | null;
    readonly requesterId: string;
  }): Promise<MigrationSelection> {
    return this.adminReadOnly.acquire(
      { requesterId: input.requesterId, purpose: ACQUISITION_PURPOSE.TAXONOMY_EXPOSURE, organizationId: null },
      async (runner) => {
        const rows = (await runner.query(
          `SELECT r.id, r.organization_id, (r.status = $3 OR e.archived_at IS NOT NULL) AS read_only
             FROM core.report r
             JOIN core.reporting_period p ON p.id = r.reporting_period_id
             JOIN core.reporting_entity e ON e.id = p.reporting_entity_id
            WHERE r.deleted_at IS NULL AND r.taxonomy_version = $1
              AND ($2::uuid[] IS NULL OR r.organization_id = ANY($2::uuid[]))
            ORDER BY r.organization_id, r.id`,
          [input.from, input.organizationIds, REPORT_STATUS.LOCKED],
        )) as { id: string; organization_id: string; read_only: boolean }[];
        const movable = rows.filter((row) => !row.read_only);
        return {
          reportIds: movable.map((row) => row.id),
          organizations: new Set(movable.map((row) => row.organization_id)).size,
          leftOut: rows.length - movable.length,
        };
      },
    );
  }

  start(input: {
    readonly standard: string;
    readonly from: string;
    readonly to: string;
    readonly toTemplateVersion: string;
    readonly determination: Compatibility;
    readonly reportIds: readonly string[];
    readonly operatorId: string;
  }): Promise<{ readonly id: string }> {
    return this.inTransaction(async (runner) => {
      const [run] = (await runner.query(
        `INSERT INTO config.migration_run
           (standard, from_taxonomy_version, to_taxonomy_version, to_template_version, determination, report_ids, requested_by)
         VALUES ($1, $2, $3, $4, $5, $6::uuid[], $7)
         RETURNING id`,
        [input.standard, input.from, input.to, input.toTemplateVersion, input.determination, input.reportIds, input.operatorId],
      )) as { id: string }[];
      await writeOutboxEvent(runner, {
        eventType: TAXONOMY_MIGRATION_RUN_REQUESTED,
        payload: { runId: run.id },
        organizationId: null,
        idempotencyKey: `migration-run/${run.id}`,
      });
      return { id: run.id };
    });
  }

  list(input: { readonly requesterId: string }): Promise<readonly MigrationRunSummary[]> {
    return this.adminReadOnly.acquire(
      { requesterId: input.requesterId, purpose: ACQUISITION_PURPOSE.TAXONOMY_EXPOSURE, organizationId: null },
      async (runner) => {
        const runs = (await runner.query(`${RUNS} ORDER BY r.requested_at DESC, r.id DESC LIMIT $1`, [LISTED])) as RunRow[];
        const tallies = await talliesOf({ runner, runIds: runs.map((run) => run.id) });
        return runs.map((run) => summaryOf({ run, rows: tallies.filter((row) => row.run_id === run.id) }));
      },
    );
  }

  read(input: { readonly id: string; readonly requesterId: string }): Promise<MigrationRunDetail | null> {
    return this.adminReadOnly.acquire(
      { requesterId: input.requesterId, purpose: ACQUISITION_PURPOSE.TAXONOMY_EXPOSURE, organizationId: null },
      async (runner) => {
        const [run] = (await runner.query(`${RUNS} WHERE r.id = $1`, [input.id])) as RunRow[];
        if (run === undefined) return null;
        const tallies = await talliesOf({ runner, runIds: [run.id] });
        const selected = (await runner.query(
          `SELECT rep.organization_id, o.name, count(*)::int AS reports
             FROM config.migration_run r
             CROSS JOIN LATERAL unnest(r.report_ids) AS chosen(report_id)
             JOIN core.report rep ON rep.id = chosen.report_id
             JOIN core.organization o ON o.id = rep.organization_id
            WHERE r.id = $1
            GROUP BY rep.organization_id, o.name
            ORDER BY ${collated('o.name')}, rep.organization_id`,
          [run.id],
        )) as { organization_id: string; name: string; reports: number }[];
        const organizations = selected.map((row): MigrationRunOrganization => {
          const tally = tallyOf(tallies.filter((entry) => entry.organization_id === row.organization_id).map(statusCount));
          return {
            organizationId: row.organization_id,
            name: row.name,
            selected: row.reports,
            pending: pendingOf({ selected: row.reports, tally }),
            tally,
          };
        });
        return { ...summaryOf({ run, rows: tallies }), organizations };
      },
    );
  }

  async requestRetry(input: { readonly id: string }): Promise<void> {
    await this.inTransaction((runner) =>
      writeOutboxEvent(runner, {
        eventType: TAXONOMY_MIGRATION_RUN_REQUESTED,
        payload: { runId: input.id },
        organizationId: null,
        idempotencyKey: `migration-run/${input.id}/retry/${Date.now()}`,
      }),
    );
  }

  markReverted(input: { readonly id: string; readonly operatorId: string }): Promise<boolean> {
    return this.inTransaction(async (runner) => {
      const [rows] = (await runner.query(
        `UPDATE config.migration_run SET reverted_at = now(), reverted_by = $2
          WHERE id = $1 AND reverted_at IS NULL
          RETURNING id`,
        [input.id, input.operatorId],
      )) as [{ id: string }[], number];
      if (rows.length === 0) return false;
      await writeOutboxEvent(runner, {
        eventType: TAXONOMY_MIGRATION_RUN_REVERTED,
        payload: { runId: input.id },
        organizationId: null,
        idempotencyKey: `migration-run/${input.id}/reversion`,
      });
      return true;
    });
  }

  private async inTransaction<T>(work: (runner: QueryRunner) => Promise<T>): Promise<T> {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      const result = await work(runner);
      await runner.commitTransaction();
      return result;
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }
}

/** A run with its operator's address — `esg_admin_ro` reads `identity.admin_account (id, email)` and nothing else of it. */
const RUNS = `SELECT r.id, r.from_taxonomy_version, r.to_taxonomy_version, r.to_template_version, r.determination,
                     r.requested_at, r.reverted_at, cardinality(r.report_ids)::int AS selected, a.email AS requested_by
                FROM config.migration_run r
                LEFT JOIN identity.admin_account a ON a.id = r.requested_by`;

interface RunRow {
  id: string;
  from_taxonomy_version: string;
  to_taxonomy_version: string;
  to_template_version: string;
  determination: string;
  requested_at: Date;
  reverted_at: Date | null;
  selected: number;
  requested_by: string | null;
}

interface TallyRow {
  run_id: string;
  organization_id: string;
  status: ReportMigrationStatus;
  reports: number;
}

async function talliesOf(input: { readonly runner: QueryRunner; readonly runIds: readonly string[] }): Promise<readonly TallyRow[]> {
  if (input.runIds.length === 0) return [];
  const rows = (await input.runner.query(
    `SELECT run_id, organization_id, status, count(*)::int AS reports
       FROM core.report_migration
      WHERE run_id = ANY($1::uuid[])
      GROUP BY run_id, organization_id, status`,
    [input.runIds],
  )) as { run_id: string; organization_id: string; status: string; reports: number }[];
  // A status this release cannot name is left uncounted rather than miscounted.
  return rows.flatMap((row) => (isReportMigrationStatus(row.status) ? [{ ...row, status: row.status }] : []));
}

const statusCount = (row: TallyRow) => ({ status: row.status, reports: row.reports });

function summaryOf(input: { readonly run: RunRow; readonly rows: readonly TallyRow[] }): MigrationRunSummary {
  const tally = tallyOf(input.rows.map(statusCount));
  return {
    id: input.run.id,
    from: input.run.from_taxonomy_version,
    to: input.run.to_taxonomy_version,
    toTemplateVersion: input.run.to_template_version,
    determination: input.run.determination === COMPATIBILITY.BREAKING ? COMPATIBILITY.BREAKING : COMPATIBILITY.COMPATIBLE,
    requestedAt: input.run.requested_at,
    requestedBy: input.run.requested_by,
    revertedAt: input.run.reverted_at,
    selected: input.run.selected,
    pending: pendingOf({ selected: input.run.selected, tally }),
    tally,
  };
}
