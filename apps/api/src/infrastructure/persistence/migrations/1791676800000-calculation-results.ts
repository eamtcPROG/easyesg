import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * What a calculation run computed — §7.2's `CALC_RESULT`, *"→ B3 elements"* (task 38.4; FR-34, FR-35, NFR-19).
 *
 * **One row per B3 figure a run answers**: the element and the tonnes it computed, or `NULL` where no line of that
 * scope was measured (FR-30 — no total, not zero). Stored rather than recomputed on demand because NFR-19's replay is
 * a *comparison*: a run reproduces when computing its retained inputs again against its pinned set gives these
 * numbers, and a figure with nothing to compare against cannot be shown to reproduce.
 *
 * **`core.calc_run`'s guarantees, unchanged** (task 38.1): `esg_app` holds `SELECT` and `INSERT` only, the table
 * carries no `UPDATE` or `DELETE` policy, its keys into the run and the report take no `ON DELETE` action, and FR-22's
 * lock guard refuses a result written while the period is locked.
 */
export class CalculationResults1791676800000 implements MigrationInterface {
  /** §7.6's expression, identical to every other policy so they cannot drift apart. */
  private readonly boundOrganization = `NULLIF(current_setting('app.current_org', true), '')::uuid`;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE core.calc_result (
        id              uuid    PRIMARY KEY DEFAULT uuidv7(),
        organization_id uuid    NOT NULL,
        report_id       uuid    NOT NULL,
        run_id          uuid    NOT NULL,
        -- The B3 element this figure answers — a VSME element key, as core.report_disclosure_value holds them.
        element_key     text    NOT NULL,
        -- Tonnes of CO₂-equivalent, unrounded and exact (§12.5.6's task-38.2 row); NULL where nothing was measured.
        value_numeric   numeric,

        CONSTRAINT calc_result_non_negative CHECK (value_numeric >= 0),

        FOREIGN KEY (run_id, report_id, organization_id)
          REFERENCES core.calc_run (id, report_id, organization_id),
        FOREIGN KEY (report_id, organization_id) REFERENCES core.report (id, organization_id),
        UNIQUE (run_id, element_key)
      )
    `);

    await queryRunner.query(`GRANT SELECT, INSERT ON core.calc_result TO esg_app`);
    await queryRunner.query(`GRANT SELECT ON core.calc_result TO esg_worker, esg_admin_ro`);

    await queryRunner.query(`ALTER TABLE core.calc_result ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE core.calc_result FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY calc_result_tenant_select ON core.calc_result
        FOR SELECT USING (organization_id = ${this.boundOrganization})
    `);
    await queryRunner.query(`
      CREATE POLICY calc_result_tenant_insert ON core.calc_result
        FOR INSERT WITH CHECK (organization_id = ${this.boundOrganization})
    `);

    await queryRunner.query(`
      CREATE TRIGGER refuse_locked_write
        BEFORE INSERT OR UPDATE OR DELETE ON core.calc_result
        FOR EACH ROW EXECUTE FUNCTION core.refuse_locked_disclosure_write()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE core.calc_result`);
  }
}
