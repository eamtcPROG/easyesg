import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The worker's right to move a report's pin (task 67.18; UC-78; FR-69, FR-66; 182/42; `architecture.md` §12.5.6's
 * task-67.18 row and §7.6).
 *
 * A migration run is `esg_worker`'s — one transaction per report, bound to that report's organization, so row security
 * still confines it — and it moves the report to the version the run migrates to. **`UPDATE` on the two pin columns
 * and on no other**: everything else a run keeps is the pre-migration state's own table (67.19), written by `INSERT`.
 * `esg_app` still cannot write either pin (task 31.3), and `test/schema-invariants.e2e-spec.ts` now asserts both
 * roles' column lists, each in both directions.
 */
export class WorkerPinMove1793923200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`GRANT UPDATE (taxonomy_version, template_version) ON core.report TO esg_worker`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`REVOKE UPDATE (taxonomy_version, template_version) ON core.report FROM esg_worker`);
  }
}
