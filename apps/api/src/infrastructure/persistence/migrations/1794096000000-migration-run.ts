import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A taxonomy migration run (task 67.23; UC-78; FR-69; 182/42, 182/160; `architecture.md` §12.5.6's task-67.23 row) —
 * the platform's record of one: the pair it moves reports between, the template release it moves them to, the pair's
 * determination as it stood when the run started, the reports it selected, who started it and whether it was reverted.
 *
 * **A platform table, not a tenant's**: it names reports across organizations, by id alone, and holds none of their
 * content (D-5) — what happened to each report is `core.report_migration`'s, under that report's organization's row
 * security, and `run_id` there is a bare id because no foreign key crosses the schemas. **The determination is copied**,
 * not read back from the mapping, because a run moved its reports under the mapping in force when it started and a later
 * publication must not rewrite what it was.
 *
 * `esg_app` starts a run (`INSERT`) and marks it reverted — the two columns that say so, and nothing else; the worker
 * reads it to execute, and the console reads it through `esg_admin_ro`.
 */
export class MigrationRun1794096000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE config.migration_run (
        id                    uuid        PRIMARY KEY DEFAULT uuidv7(),
        standard              text        NOT NULL,
        from_taxonomy_version text        NOT NULL,
        to_taxonomy_version   text        NOT NULL,
        to_template_version   text        NOT NULL,
        determination         text        NOT NULL,
        report_ids            uuid[]      NOT NULL,
        requested_by          uuid        NOT NULL,
        requested_at          timestamptz NOT NULL DEFAULT now(),
        reverted_at           timestamptz,
        reverted_by           uuid,
        CONSTRAINT migration_run_determination_known CHECK (determination IN ('compatible', 'breaking')),
        CONSTRAINT migration_run_moves_forward CHECK (from_taxonomy_version < to_taxonomy_version),
        CONSTRAINT migration_run_selects_reports CHECK (cardinality(report_ids) > 0),
        CONSTRAINT migration_run_reversion_whole CHECK ((reverted_at IS NULL) = (reverted_by IS NULL))
      )
    `);
    await queryRunner.query(`CREATE INDEX migration_run_requested_idx ON config.migration_run (requested_at DESC)`);
    await queryRunner.query(`GRANT SELECT, INSERT ON config.migration_run TO esg_app`);
    await queryRunner.query(`GRANT UPDATE (reverted_at, reverted_by) ON config.migration_run TO esg_app`);
    await queryRunner.query(`GRANT SELECT ON config.migration_run TO esg_worker, esg_admin_ro`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE config.migration_run`);
  }
}
