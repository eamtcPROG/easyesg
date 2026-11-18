import { Injectable } from '@nestjs/common';
import {
  REPORT_MIGRATION_STATUS,
  RESTORE_ANSWER,
  RESTORE_OUTCOME,
  type RestoreAnswer,
} from '@api/contracts/report-migration';
import type { ReportMigrationDecisionStore } from '@api/modules/core/disclosure/interfaces/report-migration-decision-store.interface';
import type { AwaitingMigration } from '@api/modules/core/disclosure/models/report-migration-review.model';
import { returnedRows } from '../returned-rows';
import { TenantRepository } from '../tenant-repository';

/**
 * `REPORT_MIGRATION_DECISION_STORE` (task 67.20; 182/43) — **on the request's transaction**, as `esg_app`, so row
 * security confines every statement to the bound organization and none names it. `esg_app` may move a row's status and
 * record who decided and when, and nothing else of it (task 67.19's grants); `guard_report_migration` admits only a move
 * out of `awaiting_review`. The acceptance is a conditional update, so two administrators deciding at once cannot both
 * win; the decline is `core.restore_report_migration`, which locks the row first.
 */
@Injectable()
export class ReportMigrationDecisionStoreRepository extends TenantRepository<never> implements ReportMigrationDecisionStore {
  protected readonly entity = 'core.report_migration' as never;

  async awaiting(query: { readonly reportId: string }): Promise<AwaitingMigration | null> {
    const [row] = await this.manager.query<
      { id: string; run_id: string; from_taxonomy_version: string; to_taxonomy_version: string; migrated_at: Date }[]
    >(
      `SELECT id, run_id, from_taxonomy_version, to_taxonomy_version, migrated_at
         FROM core.report_migration
        WHERE report_id = $1 AND status = $2
        ORDER BY migrated_at DESC, id DESC
        LIMIT 1`,
      [query.reportId, REPORT_MIGRATION_STATUS.AWAITING_REVIEW],
    );
    return row === undefined
      ? null
      : { id: row.id, runId: row.run_id, from: row.from_taxonomy_version, to: row.to_taxonomy_version, migratedAt: row.migrated_at };
  }

  async accept(command: { readonly migrationId: string; readonly accountId: string }): Promise<boolean> {
    const rows = returnedRows<{ id: string }>(
      await this.manager.query(
        `UPDATE core.report_migration SET status = $3, decided_at = now(), decided_by = $2
          WHERE id = $1 AND status = $4
          RETURNING id`,
        [command.migrationId, command.accountId, REPORT_MIGRATION_STATUS.ACCEPTED, REPORT_MIGRATION_STATUS.AWAITING_REVIEW],
      ),
    );
    return rows.length === 1;
  }

  async decline(command: { readonly migrationId: string; readonly accountId: string }): Promise<RestoreAnswer> {
    const [row] = await this.manager.query<{ answer: string }[]>(`SELECT core.restore_report_migration($1, $2, $3) AS answer`, [
      command.migrationId,
      command.accountId,
      RESTORE_OUTCOME.DECLINED,
    ]);
    const answer = Object.values(RESTORE_ANSWER).find((known) => known === row?.answer);
    if (answer === undefined) throw new Error(`core.restore_report_migration answered ${String(row?.answer)}.`);
    return answer;
  }

  async stillAwaiting(query: { readonly runId: string }): Promise<number> {
    const [row] = await this.manager.query<{ waiting: number }[]>(
      `SELECT count(*)::int AS waiting FROM core.report_migration WHERE run_id = $1 AND status = $2`,
      [query.runId, REPORT_MIGRATION_STATUS.AWAITING_REVIEW],
    );
    return row?.waiting ?? 0;
  }
}
