import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * FR-41's *Mark as filed* — the reporter's own record that a report has left the building (task 47.5;
 * `architecture.md` §12.5.6's task-47 row (1)–(4), project owner, 12 Oct 2026; 182/19).
 *
 * **A mark of its own beside the status, never the status.** `core.report.status` is the period lock's shadow, and a
 * lock or a reopening rewrites it for every report in the period — a `filed` written there would be erased by the next
 * one. The mark is four columns the lock leaves alone: the date the reporter says the report was filed, `filed_on`
 * with its `filed_on_tz` (NFR-34, §7.9's pairing), and `filed_at` and `filed_by`, **written by the database from the
 * moment and from `app.current_user`**, as `overridden_by` is (task 39.4), so a caller cannot name someone else.
 * `esg_app` may write the date and its zone and nothing else of the mark.
 *
 * **The lock lets the mark move**: most reports are marked after their period is locked, and a mark freezes nothing —
 * the lock alone does (row (2)). The lock's function is replaced to leave the four columns out of the row it compares,
 * exactly as it already leaves out the status.
 *
 * **Withdrawing is clearing the date**, and the trigger clears who and when with it; `core.report`'s field-change
 * capture keeps the trail of both acts (row (3)).
 */
export class ReportFiling1793059200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE core.report
        ADD COLUMN filed_on    date,
        ADD COLUMN filed_on_tz text,
        ADD COLUMN filed_at    timestamptz,
        ADD COLUMN filed_by    uuid,
        -- All four or none: a mark is a date, its zone, a moment and a person.
        ADD CONSTRAINT report_filing_whole CHECK (
          (filed_on IS NULL) = (filed_on_tz IS NULL)
          AND (filed_on IS NULL) = (filed_at IS NULL)
          AND (filed_on IS NULL) = (filed_by IS NULL)
        ),
        ADD CONSTRAINT report_filing_zone_named CHECK (filed_on_tz IS NULL OR filed_on_tz <> '')
    `);

    await queryRunner.query(`
      CREATE FUNCTION core.stamp_report_filing() RETURNS trigger
        LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.filed_on IS NULL THEN
          NEW.filed_at := NULL;
          NEW.filed_by := NULL;
        ELSIF TG_OP = 'INSERT'
           OR OLD.filed_on IS NULL
           OR OLD.filed_on IS DISTINCT FROM NEW.filed_on
           OR OLD.filed_on_tz IS DISTINCT FROM NEW.filed_on_tz THEN
          NEW.filed_at := now();
          NEW.filed_by := NULLIF(current_setting('app.current_user', true), '')::uuid;
        ELSE
          NEW.filed_at := OLD.filed_at;
          NEW.filed_by := OLD.filed_by;
        END IF;
        RETURN NEW;
      END
      $$
    `);
    await queryRunner.query(`
      CREATE TRIGGER report_stamp_filing
        BEFORE INSERT OR UPDATE ON core.report
        FOR EACH ROW EXECUTE FUNCTION core.stamp_report_filing()
    `);

    // The date and its zone are the reporter's; the moment and the person are the trigger's alone.
    await queryRunner.query(`GRANT UPDATE (filed_on, filed_on_tz) ON core.report TO esg_app`);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION core.refuse_locked_report_write() RETURNS trigger
        LANGUAGE plpgsql AS $$
      BEGIN
        IF (to_jsonb(NEW) - 'status' - 'updated_at' - 'filed_on' - 'filed_on_tz' - 'filed_at' - 'filed_by')
           IS DISTINCT FROM
           (to_jsonb(OLD) - 'status' - 'updated_at' - 'filed_on' - 'filed_on_tz' - 'filed_at' - 'filed_by') THEN
          RAISE EXCEPTION 'report % is locked', OLD.id USING ERRCODE = '45001';
        END IF;
        RETURN NEW;
      END;
      $$
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION core.refuse_locked_report_write() RETURNS trigger
        LANGUAGE plpgsql AS $$
      BEGIN
        IF (to_jsonb(NEW) - 'status' - 'updated_at')
           IS DISTINCT FROM
           (to_jsonb(OLD) - 'status' - 'updated_at') THEN
          RAISE EXCEPTION 'report % is locked', OLD.id USING ERRCODE = '45001';
        END IF;
        RETURN NEW;
      END;
      $$
    `);
    await queryRunner.query(`DROP TRIGGER report_stamp_filing ON core.report`);
    await queryRunner.query(`DROP FUNCTION core.stamp_report_filing()`);
    await queryRunner.query(`
      ALTER TABLE core.report
        DROP CONSTRAINT report_filing_zone_named,
        DROP CONSTRAINT report_filing_whole,
        DROP COLUMN filed_by,
        DROP COLUMN filed_at,
        DROP COLUMN filed_on_tz,
        DROP COLUMN filed_on
    `);
  }
}
