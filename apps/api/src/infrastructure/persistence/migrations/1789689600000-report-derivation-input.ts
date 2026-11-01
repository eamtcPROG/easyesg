import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The values EFRAG's template computes from and the taxonomy does not carry (task 36.10; §7.3).
 *
 * **Two Basic-module figures are derived rather than asked for**, and the Digital Template 1.3.0 is
 * the only source that says so — the taxonomy carries the results and is silent on where they come
 * from:
 *
 * - `EmployeeTurnoverRate` (B8) = `departures ÷ ((employees at start + employees at end) ÷ 2)`
 * - `RateOfRecordableWorkRelatedAccidentsInTheReportingPeriod` (B9)
 *   = `(accidents ÷ (hours per full-time employee × B1 headcount)) × 200 000`
 *
 * Of the seven values those name, **three are reportable elements** — the two rates and B9's
 * accident count — and B1's headcount is a disclosure of its own. The remaining four are what this
 * table holds. `total hours worked` is deliberately **not** among them: it is the product of two
 * values already here, so storing it would be a third place the same number is true.
 *
 * **Why not `core.report_disclosure_value` under a synthetic key.** `WriteDisclosureValues` refuses
 * an element key the registered taxonomy version does not carry, and that guard is the reason §7.3's
 * three invented example keys were caught at all. Putting these there means weakening it for exactly
 * the class of key it exists to refuse. The alternative that needed no migration — carrying the
 * template's input concepts in the taxonomy artefact as non-reportable elements — was declined by
 * the project owner: it puts two kinds of key in one column and makes the export's correctness a
 * property of a filter rather than of a table (§7.3 records both).
 *
 * **It is not a general key/value store for the report**, and that is a constraint rather than a
 * description: it holds the declared inputs of declared derivations, which
 * `config/seed/disclosure-derivation.vsme.json` enumerates. Nothing else has a home here.
 */
export class ReportDerivationInput1789689600000 implements MigrationInterface {
  /** §7.6's expression, identical to every other policy so they cannot drift apart. */
  private readonly boundOrganization = `NULLIF(current_setting('app.current_org', true), '')::uuid`;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE core.report_derivation_input (
        id              uuid    NOT NULL DEFAULT uuidv7(),

        report_id       uuid    NOT NULL,
        organization_id uuid    NOT NULL,

        -- Which input this is, e.g. HoursWorkedByOneFullTimeEmployee. Named in the derivation
        -- artefact rather than constrained here, on element_key's own reasoning: the set belongs
        -- to a template version (DR-4), and a CHECK is frozen history the day it ships.
        input_key       text    NOT NULL,

        -- numeric, never float, and NOT NULL because there is no other kind of derivation input and
        -- no meaning for an absent one: a row that exists is a value the reporter supplied. An input
        -- nobody has answered is an absent row, which is how the artefact's default stays reachable.
        value_numeric   numeric NOT NULL,

        created_at      timestamptz NOT NULL DEFAULT now(),
        updated_at      timestamptz NOT NULL DEFAULT now(),

        PRIMARY KEY (id),

        -- The natural key. One value per input per report; unlike a disclosure there is no dimension
        -- and no ordinal, because an input to a whole-report figure has nothing to vary along.
        UNIQUE (report_id, input_key),

        -- Tied to the report's tenant rather than merely copied, as core.report_disclosure_value is
        -- and for the same reason: RLS enforces whatever this column says, so a wrong value hides a
        -- row from its own tenant or exposes it to another.
        FOREIGN KEY (report_id, organization_id)
          REFERENCES core.report (id, organization_id) ON DELETE CASCADE
      )
    `);

    // **No second index.** The value store carries an organization-leading one because §7.3
    // prescribes it for tenant-wide scans; this table is read one report at a time by the step read
    // and the export, which the natural-key UNIQUE already serves leading with report_id. Adding an
    // unread index to a table of four rows per report would be cargo — 34.1 measured that the
    // equivalent index there is currently unread even on the high-volume table.

    // ── Grants: DR-6's mechanism narrowed to columns, as the value store does ───────────────────
    //
    // The application writes the value; it never moves a row to another report or another input key.
    // Those are the row's identity, and withholding UPDATE makes a rewrite unreachable from the
    // request tier rather than merely absent from a repository.
    await queryRunner.query(`GRANT SELECT, INSERT, DELETE ON core.report_derivation_input TO esg_app`);
    await queryRunner.query(`
      GRANT UPDATE (value_numeric, updated_at) ON core.report_derivation_input TO esg_app
    `);
    await queryRunner.query(`GRANT SELECT ON core.report_derivation_input TO esg_worker, esg_admin_ro`);

    await queryRunner.query(`ALTER TABLE core.report_derivation_input ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE core.report_derivation_input FORCE ROW LEVEL SECURITY`);
    for (const statement of [
      `CREATE POLICY report_derivation_input_tenant_select ON core.report_derivation_input
         FOR SELECT USING (organization_id = ${this.boundOrganization})`,
      `CREATE POLICY report_derivation_input_tenant_insert ON core.report_derivation_input
         FOR INSERT WITH CHECK (organization_id = ${this.boundOrganization})`,
      `CREATE POLICY report_derivation_input_tenant_update ON core.report_derivation_input
         FOR UPDATE USING (organization_id = ${this.boundOrganization})
                 WITH CHECK (organization_id = ${this.boundOrganization})`,
      `CREATE POLICY report_derivation_input_tenant_delete ON core.report_derivation_input
         FOR DELETE USING (organization_id = ${this.boundOrganization})`,
    ]) {
      await queryRunner.query(statement);
    }

    // ── FR-22's lock, and task 31.4's invariant ────────────────────────────────────────────────
    //
    // **The existing function is attached unchanged**, which is the point of it having been written
    // to read `report_id` off `OLD` or `NEW` rather than off a named table: task 34.1 built it for
    // the value store and `1789430400000` extended it to DELETE after measuring that a child guard
    // cannot see a locked parent during a referential cascade. Both findings apply here verbatim,
    // and a second copy of the function would be a second place that measurement is recorded.
    await queryRunner.query(`
      CREATE TRIGGER refuse_locked_write
        BEFORE INSERT OR UPDATE OR DELETE ON core.report_derivation_input
        FOR EACH ROW EXECUTE FUNCTION core.refuse_locked_disclosure_write()
    `);

    // FR-54's per-field capture. A derivation input is a number a person entered that changes a
    // filed figure, so it needs the trail for the same reason the disclosure does — and NFR-7 makes
    // attribution unretrofittable, so it is attached with the table rather than after it.
    await queryRunner.query(`
      CREATE TRIGGER capture_field_change
        AFTER INSERT OR UPDATE OR DELETE ON core.report_derivation_input
        FOR EACH ROW EXECUTE FUNCTION core.capture_field_change('organization_id', 'updated_at')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // The function is task 34.1's and stays; only the trigger bound to this table goes with it.
    await queryRunner.query(`DROP TABLE core.report_derivation_input`);
  }
}
