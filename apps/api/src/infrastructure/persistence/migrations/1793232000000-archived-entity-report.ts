import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * FR-20's behaviour 7 (task 214; `architecture.md` §12.5.6's task-214 row): **a report on an archived entity's period is
 * read-only from the archive**, refused where the lock is refused — by the database (P-4) — so no write path can miss
 * it.
 *
 * - **`core.refuse_locked_disclosure_write()` learns the archive.** Every report-scoped table that takes answers —
 *   disclosure values, derivation inputs, calculator sources, runs and results — already runs it, so one function
 *   reaches all of them. It raises SQLSTATE **`45002`** where the report's entity is archived, **before** the lock's
 *   `45001` (row (a): reopening an archived entity's period restores no editing, so the archive is the cause to name).
 *   Class 45 is ours by the standard's leave (task 31.2), and a second code is what lets the repositories tell the two
 *   refusals apart without re-reading.
 * - **A change of the report's scope is refused the same way** — the one column of `core.report` a writer of answers
 *   moves. Its status (the period's lock and reopening, the filed mark) and its filing columns stay writable: a lock is
 *   the period's (row (b)), and the filed mark is one of what the report still accepts (row (2)).
 * - **`core.delete_report` answers `archived`** before `locked`, since the archive retains an entity's reports (row (2)).
 *
 * **A cascade is unaffected**, for the reason task 34.1 measured of the lock: the guard reads the report's parents, and
 * `ON DELETE CASCADE` has removed them before a child row's trigger runs, so an organization's deletion is not refused by
 * an archived entity's report (row (c)).
 */
export class ArchivedEntityReport1793232000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Read by the guard and by the deletion; `STABLE`, since it reads tables and writes none.
    await queryRunner.query(`
      CREATE FUNCTION core.report_entity_archived(target uuid) RETURNS boolean
        LANGUAGE sql STABLE AS $$
        SELECT EXISTS (
          SELECT 1 FROM core.report r
            JOIN core.reporting_period p ON p.id = r.reporting_period_id
            JOIN core.reporting_entity e ON e.id = p.reporting_entity_id
           WHERE r.id = target AND e.status = 'archived'
        )
      $$
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION core.refuse_locked_disclosure_write() RETURNS trigger
        LANGUAGE plpgsql AS $$
      DECLARE
        subject uuid;
      BEGIN
        IF TG_OP = 'DELETE' THEN subject := OLD.report_id; ELSE subject := NEW.report_id; END IF;

        IF core.report_entity_archived(subject) THEN
          RAISE EXCEPTION 'report % belongs to an archived entity', subject USING ERRCODE = '45002';
        END IF;

        IF EXISTS (
          SELECT 1 FROM core.report r
           WHERE r.id = subject AND r.status = 'locked'
        ) THEN
          RAISE EXCEPTION 'report % is locked', subject USING ERRCODE = '45001';
        END IF;

        IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
        RETURN NEW;
      END;
      $$
    `);

    await queryRunner.query(`
      CREATE FUNCTION core.refuse_archived_report_write() RETURNS trigger
        LANGUAGE plpgsql AS $$
      BEGIN
        IF core.report_entity_archived(OLD.id) THEN
          RAISE EXCEPTION 'report % belongs to an archived entity', OLD.id USING ERRCODE = '45002';
        END IF;
        RETURN NEW;
      END;
      $$
    `);
    // `WHEN` keeps the function off every other write to the row — a lock, a reopening, the filed mark.
    await queryRunner.query(`
      CREATE TRIGGER refuse_archived_write
        BEFORE UPDATE ON core.report
        FOR EACH ROW WHEN (OLD.scope IS DISTINCT FROM NEW.scope)
        EXECUTE FUNCTION core.refuse_archived_report_write()
    `);

    await queryRunner.query(deleteReport({ refusesArchived: true }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(deleteReport({ refusesArchived: false }));
    await queryRunner.query(`DROP TRIGGER refuse_archived_write ON core.report`);
    await queryRunner.query(`DROP FUNCTION core.refuse_archived_report_write()`);
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION core.refuse_locked_disclosure_write() RETURNS trigger
        LANGUAGE plpgsql AS $$
      DECLARE
        subject uuid;
      BEGIN
        IF TG_OP = 'DELETE' THEN subject := OLD.report_id; ELSE subject := NEW.report_id; END IF;

        IF EXISTS (
          SELECT 1 FROM core.report r
           WHERE r.id = subject AND r.status = 'locked'
        ) THEN
          RAISE EXCEPTION 'report % is locked', subject USING ERRCODE = '45001';
        END IF;

        IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
        RETURN NEW;
      END;
      $$
    `);
    await queryRunner.query(`DROP FUNCTION core.report_entity_archived(uuid)`);
  }
}

/**
 * `core.delete_report` as task 192 wrote it, and — with `refusesArchived` — answering `archived` first. **Both bodies
 * from one text**, so the revert restores exactly what the deletion migration created rather than a second copy of it
 * that could drift. A `SECURITY DEFINER` body names every object by schema, under its pinned `search_path`.
 */
function deleteReport(input: { readonly refusesArchived: boolean }): string {
  const archived = input.refusesArchived
    ? `
        IF core.report_entity_archived(target) THEN
          RETURN 'archived';
        END IF;`
    : '';
  return `
      CREATE OR REPLACE FUNCTION core.delete_report(target uuid) RETURNS text
        LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
      DECLARE
        found_status text;
      BEGIN
        SELECT r.status INTO found_status
          FROM core.report r
         WHERE r.id = target
           AND r.organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid
           AND r.deleted_at IS NULL
         FOR UPDATE;
        IF NOT FOUND THEN
          RETURN 'not_found';
        END IF;${archived}
        IF found_status = 'locked' THEN
          RETURN 'locked';
        END IF;
        IF EXISTS (
          SELECT 1 FROM core.export_artifact a
           WHERE a.report_id = target AND a.status IN ('requested', 'completed')
        ) THEN
          RETURN 'exported';
        END IF;
        UPDATE core.report SET deleted_at = now(), updated_at = now() WHERE id = target;
        RETURN 'deleted';
      END
      $$
    `;
}
