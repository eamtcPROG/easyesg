import { Injectable } from '@nestjs/common';
import {
  REPORT_MIGRATION_STATUS,
  RESTORE_ANSWER,
  RESTORE_OUTCOME,
  isReportMigrationStatus,
  type ReportMigrationStatus,
  type RestoreAnswer,
} from '@api/contracts/report-migration';
import { REPORT_STATUS } from '@api/modules/core/disclosure/models/report.model';
import { MEMBERSHIP_ROLE, MEMBERSHIP_STATUS } from '@api/modules/identity/membership/models/membership.model';
import { mayMove, movedStatusOf } from '@api/modules/platform/taxonomy/domain/migration-run';
import type { RunToExecute } from '@api/modules/platform/taxonomy/interfaces/migration-run-directory.interface';
import type {
  ReportMigrationOutcome,
  ReportMigrations,
} from '@api/modules/platform/taxonomy/interfaces/report-migrations.interface';
import { TenantRepository } from '../tenant-repository';
import { editAudience } from './edit-audience';

const BOUND = `NULLIF(current_setting('app.current_org', true), '')::uuid`;

/**
 * `REPORT_MIGRATIONS` (task 67.24; 182/41, 182/42; §12.5.6's task-67.24 row) — one organization's half of a run, **on
 * the transaction `TENANT_WORK` bound to it**, as `esg_worker`: row security confines every statement and none names
 * the organization. The report is locked `FOR UPDATE` before anything is read from it, so a lock or a write landing
 * meanwhile waits for the move or finds it done.
 *
 * **The run writes its row once per report** (`UNIQUE (run_id, report_id)`): a report already settled answers its
 * status and is left alone; a failed one is filled in place by the next attempt — `guard_report_migration` admits a
 * snapshot written over a `failed` row and refuses it over any other. **The worker moves the two pins and nothing else
 * of the report** (182/42): the retained state is copied, never rewritten, so a migration changes no answer.
 */
@Injectable()
export class ReportMigrationsRepository extends TenantRepository<never> implements ReportMigrations {
  protected readonly entity = 'core.report' as never;

  async migrate(input: { readonly run: RunToExecute; readonly reportId: string }): Promise<ReportMigrationStatus | null> {
    const [report] = await this.manager.query<
      { taxonomy_version: string; template_version: string; status: string; archived: boolean }[]
    >(
      `SELECT r.taxonomy_version, r.template_version, r.status, e.archived_at IS NOT NULL AS archived
         FROM core.report r
         JOIN core.reporting_period p ON p.id = r.reporting_period_id
         JOIN core.reporting_entity e ON e.id = p.reporting_entity_id
        WHERE r.id = $1
        FOR UPDATE OF r`,
      [input.reportId],
    );
    // Deleted since the run selected it: no report to record a row against.
    if (report === undefined) return null;

    const [settled] = await this.manager.query<{ status: string }[]>(
      `SELECT status FROM core.report_migration WHERE run_id = $1 AND report_id = $2`,
      [input.run.id, input.reportId],
    );
    if (settled !== undefined && settled.status !== REPORT_MIGRATION_STATUS.FAILED && isReportMigrationStatus(settled.status)) {
      return settled.status;
    }

    const standing = {
      taxonomyVersion: report.taxonomy_version,
      locked: report.status === REPORT_STATUS.LOCKED,
      archived: report.archived,
    };
    if (!mayMove({ report: standing, from: input.run.from })) {
      await this.record({ run: input.run, reportId: input.reportId, status: REPORT_MIGRATION_STATUS.SKIPPED, from: report });
      return REPORT_MIGRATION_STATUS.SKIPPED;
    }

    const status = movedStatusOf(input.run.determination);
    await this.manager.query(
      `INSERT INTO core.report_migration
         (organization_id, report_id, run_id, from_taxonomy_version, from_template_version, to_taxonomy_version,
          to_template_version, status, prior_values, prior_inputs)
       VALUES (${BOUND}, $1, $2, $3, $4, $5, $6, $7,
               (SELECT coalesce(jsonb_agg(to_jsonb(v)), '[]'::jsonb) FROM core.report_disclosure_value v WHERE v.report_id = $1),
               (SELECT coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb) FROM core.report_derivation_input i WHERE i.report_id = $1))
       ON CONFLICT (run_id, report_id) DO UPDATE
         SET status = EXCLUDED.status, prior_values = EXCLUDED.prior_values, prior_inputs = EXCLUDED.prior_inputs,
             from_taxonomy_version = EXCLUDED.from_taxonomy_version, from_template_version = EXCLUDED.from_template_version,
             error = NULL, migrated_at = now()`,
      [
        input.reportId,
        input.run.id,
        report.taxonomy_version,
        report.template_version,
        input.run.to,
        input.run.toTemplateVersion,
        status,
      ],
    );
    await this.manager.query(`UPDATE core.report SET taxonomy_version = $2, template_version = $3 WHERE id = $1`, [
      input.reportId,
      input.run.to,
      input.run.toTemplateVersion,
    ]);
    return status;
  }

  async recordFailure(input: { readonly run: RunToExecute; readonly reportId: string; readonly error: string }): Promise<void> {
    const [report] = await this.manager.query<{ taxonomy_version: string; template_version: string }[]>(
      `SELECT taxonomy_version, template_version FROM core.report WHERE id = $1`,
      [input.reportId],
    );
    if (report === undefined) return;
    await this.record({
      run: input.run,
      reportId: input.reportId,
      status: REPORT_MIGRATION_STATUS.FAILED,
      from: report,
      error: input.error,
    });
  }

  async outcomes(input: { readonly runId: string }): Promise<readonly ReportMigrationOutcome[]> {
    const rows = await this.manager.query<{ report_id: string; status: string; name: string; fiscal_year: number }[]>(
      `SELECT m.report_id, m.status, e.name, p.fiscal_year
         FROM core.report_migration m
         JOIN core.report r ON r.id = m.report_id
         JOIN core.reporting_period p ON p.id = r.reporting_period_id
         JOIN core.reporting_entity e ON e.id = p.reporting_entity_id
        WHERE m.run_id = $1
        ORDER BY m.report_id`,
      [input.runId],
    );
    return rows.flatMap((row) =>
      isReportMigrationStatus(row.status)
        ? [{ reportId: row.report_id, status: row.status, entityName: row.name, fiscalYear: row.fiscal_year }]
        : [],
    );
  }

  async restorable(input: { readonly runId: string }): Promise<readonly string[]> {
    const rows = await this.manager.query<{ id: string }[]>(
      `SELECT id FROM core.report_migration WHERE run_id = $1 AND status = ANY($2::text[]) ORDER BY id`,
      [input.runId, [REPORT_MIGRATION_STATUS.MIGRATED, REPORT_MIGRATION_STATUS.AWAITING_REVIEW]],
    );
    return rows.map((row) => row.id);
  }

  async restore(input: { readonly migrationId: string }): Promise<RestoreAnswer> {
    const [row] = await this.manager.query<{ answer: string }[]>(
      `SELECT core.restore_report_migration($1, NULL, $2) AS answer`,
      [input.migrationId, RESTORE_OUTCOME.REVERTED],
    );
    const answer = Object.values(RESTORE_ANSWER).find((known) => known === row?.answer);
    if (answer === undefined) throw new Error(`core.restore_report_migration answered ${String(row?.answer)}.`);
    return answer;
  }

  editors(): Promise<readonly string[]> {
    return editAudience(this.manager);
  }

  async administrators(): Promise<readonly string[]> {
    const rows = await this.manager.query<{ account_id: string }[]>(
      `SELECT account_id FROM identity.membership WHERE status = $1 AND role = $2 ORDER BY account_id`,
      [MEMBERSHIP_STATUS.ACTIVE, MEMBERSHIP_ROLE.ORGANIZATION_ADMINISTRATOR],
    );
    return rows.map((row) => row.account_id);
  }

  /** A row recording no move — skipped or failed — with nothing retained, its pins the report's as it stood. */
  private async record(input: {
    readonly run: RunToExecute;
    readonly reportId: string;
    readonly status: ReportMigrationStatus;
    readonly from: { readonly taxonomy_version: string; readonly template_version: string };
    readonly error?: string;
  }): Promise<void> {
    await this.manager.query(
      `INSERT INTO core.report_migration
         (organization_id, report_id, run_id, from_taxonomy_version, from_template_version, to_taxonomy_version,
          to_template_version, status, error)
       VALUES (${BOUND}, $1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (run_id, report_id) DO UPDATE
         SET status = EXCLUDED.status, error = EXCLUDED.error, migrated_at = now()`,
      [
        input.reportId,
        input.run.id,
        input.from.taxonomy_version,
        input.from.template_version,
        input.run.to,
        input.run.toTemplateVersion,
        input.status,
        input.error ?? null,
      ],
    );
  }
}
