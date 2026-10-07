import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * FR-36's *naming on the figure the person who made it* — the account that replaced a computed figure, stored on the
 * figure (task 39.4; `architecture.md` §12.5.6's task-39 row (3), project owner, 7 Oct 2026; BR-CALC-3).
 *
 * **Both overrides, each where its figure lives**, as task 38.4's migration placed them: `overridden_by` on
 * `core.report_disclosure_value` for a B3 scope, `override_by` on `core.calc_source` for one line's tonnes, and the
 * line's copied into `core.calc_input` with the rest of what a run retains.
 *
 * **Taken from the request's own binding, never from a parameter** — `app.current_user`, as `core.calc_run.recorded_by`
 * and `core.field_change` attribute — so a caller cannot name someone else. A column `DEFAULT` cannot do it, since an
 * override is an `UPDATE` of a row that already stands, so a `BEFORE` trigger does, and the columns are withheld from
 * `esg_app`: no grant, so the only writer is the trigger. **No foreign key**, so the attribution outlives the account
 * (task 14's reason for `field_change.actor_id`); the read names it through a `LEFT JOIN`, and an erased account reads as
 * no name.
 *
 * **What counts as making the override** is a change to the substituted figure or to its reason. Writing a line again
 * with the same override — a description corrected, a site moved — keeps the person who made it; changing the figure
 * or the reason names whoever changed it; clearing the override, or a run replacing a B3 override, clears the person
 * with it. That is the trigger's comparison of `OLD` and `NEW`, so no path can get it wrong.
 *
 * **No backfill.** An override made before this carries no person and reads as none, as an erased account does: the
 * trail already names who made it (FR-54), and a backfill would have to write under forced row security and past
 * FR-22's lock trigger for rows no pilot has.
 */
export class OverrideAttribution1792108800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE core.report_disclosure_value
        ADD COLUMN overridden_by uuid,
        -- A person only where there is an override to have made.
        ADD CONSTRAINT report_disclosure_value_overrider_of_override
        CHECK (overridden_by IS NULL OR origin = 'overridden')
    `);
    await queryRunner.query(`
      CREATE FUNCTION core.attribute_figure_override() RETURNS trigger
        LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.origin <> 'overridden' THEN
          NEW.overridden_by := NULL;
        ELSIF TG_OP = 'INSERT'
           OR OLD.origin IS DISTINCT FROM NEW.origin
           OR OLD.value_numeric IS DISTINCT FROM NEW.value_numeric
           OR OLD.explanation IS DISTINCT FROM NEW.explanation THEN
          NEW.overridden_by := NULLIF(current_setting('app.current_user', true), '')::uuid;
        ELSE
          NEW.overridden_by := OLD.overridden_by;
        END IF;
        RETURN NEW;
      END
      $$
    `);
    await queryRunner.query(`
      CREATE TRIGGER report_disclosure_value_attribute_override
        BEFORE INSERT OR UPDATE ON core.report_disclosure_value
        FOR EACH ROW EXECUTE FUNCTION core.attribute_figure_override()
    `);

    await queryRunner.query(`
      ALTER TABLE core.calc_source
        ADD COLUMN override_by uuid,
        ADD CONSTRAINT calc_source_overrider_of_override CHECK (override_by IS NULL OR override_tonnes IS NOT NULL)
    `);
    await queryRunner.query(`
      CREATE FUNCTION core.attribute_line_override() RETURNS trigger
        LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.override_tonnes IS NULL THEN
          NEW.override_by := NULL;
        ELSIF TG_OP = 'INSERT'
           OR OLD.override_tonnes IS DISTINCT FROM NEW.override_tonnes
           OR OLD.override_explanation IS DISTINCT FROM NEW.override_explanation THEN
          NEW.override_by := NULLIF(current_setting('app.current_user', true), '')::uuid;
        ELSE
          NEW.override_by := OLD.override_by;
        END IF;
        RETURN NEW;
      END
      $$
    `);
    await queryRunner.query(`
      CREATE TRIGGER calc_source_attribute_override
        BEFORE INSERT OR UPDATE ON core.calc_source
        FOR EACH ROW EXECUTE FUNCTION core.attribute_line_override()
    `);

    // The run's copy, immutable like the rest of it: no grant beyond the INSERT the table already gives.
    await queryRunner.query(`ALTER TABLE core.calc_input ADD COLUMN override_by uuid`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE core.calc_input DROP COLUMN override_by`);
    await queryRunner.query(`DROP TRIGGER calc_source_attribute_override ON core.calc_source`);
    await queryRunner.query(`DROP FUNCTION core.attribute_line_override()`);
    await queryRunner.query(`
      ALTER TABLE core.calc_source
        DROP CONSTRAINT calc_source_overrider_of_override,
        DROP COLUMN override_by
    `);
    await queryRunner.query(`DROP TRIGGER report_disclosure_value_attribute_override ON core.report_disclosure_value`);
    await queryRunner.query(`DROP FUNCTION core.attribute_figure_override()`);
    await queryRunner.query(`
      ALTER TABLE core.report_disclosure_value
        DROP CONSTRAINT report_disclosure_value_overrider_of_override,
        DROP COLUMN overridden_by
    `);
  }
}
