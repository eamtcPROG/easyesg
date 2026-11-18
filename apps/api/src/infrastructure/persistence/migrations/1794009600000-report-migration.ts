import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The retained pre-migration state (task 67.19; UC-78; FR-69 behaviour 3 and 8, BR-VER-3; 182/41; `architecture.md`
 * §12.5.6's task-67.19 row) — and, with it, the run's record per report that 67.20, 67.23 and 67.24 read and move.
 *
 * **A report is migrated in place** (182/41): it stays the one report of its period (FR-177), its pin moves, and
 * **`core.report_migration` keeps what it was** — the pin it had, and every value and derivation input as they stood,
 * copied as row images (`prior_values`, `prior_inputs`) by the worker in the same transaction that moves the pin. Its
 * `status` is where the report stands in the run: `migrated` (a compatible change, in force), `awaiting_review` (a
 * breaking one, for the organization to accept or decline — 182/43), `accepted`, `declined` or `reverted` (the prior
 * state put back), `failed` (nothing moved; its error kept for a retry), `skipped` (the report no longer stood where
 * the run found it — another pin, or its period locked, which a run never restates).
 *
 * **A tenant table**: `organization_id`, forced row security, policies on the binding — the worker's transaction is
 * bound to the report's organization, the tenant's request to its own, and the console reads counts through
 * `esg_admin_ro` (D-5: never a value). `run_id` is a bare id: the run is the platform's (`config.migration_run`, task
 * 67.23) and no foreign key crosses the schemas. **Inside a filing** — its key reaches `core.report` — and exempt from the
 * lock's trigger, since the lock is exactly what a run refuses to cross; **unaudited by `core.field_change`**, since every
 * change here is a run's or an administrator's decision the row itself records with its time and author.
 *
 * **The prior state is put back by `core.restore_report_migration`**, `SECURITY DEFINER` for `core.delete_report`'s
 * reason — the request tier cannot move a pin (task 31.3) and a decline is the organization's (67.20); the worker's
 * revert of a whole run calls it too. It runs under the caller's binding, so it reaches the bound organization's rows
 * alone; it answers one of four words. **A decline puts back a report awaiting review; a revert, one migrated or
 * awaiting review** — an accepted report is the organization's decision, which a platform revert does not overrule — and
 * **only while the report still carries the pin the run gave it**, so a later run's result is never undone from under
 * it. **An override comes back under its own person**: `attribute_figure_override` names `app.current_user` on every
 * inserted override, so the function binds each override's own `overridden_by` for its insert and restores the caller's
 * binding afterwards — otherwise a decline would sign every override in the report with the decliner's name.
 *
 * **What a row records is guarded below the application** (P-4): `guard_report_migration` refuses a status move the
 * run's lifecycle does not have, and a change to the retained state or the pins it came from except on a `failed` row,
 * which a retry fills — so the snapshot is written once by the run that took it, and nothing rewrites it afterwards.
 */
export class ReportMigration1794009600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE core.report_migration (
        id                    uuid        PRIMARY KEY DEFAULT uuidv7(),
        organization_id       uuid        NOT NULL,
        report_id             uuid        NOT NULL,
        run_id                uuid        NOT NULL,
        from_taxonomy_version text        NOT NULL,
        from_template_version text        NOT NULL,
        to_taxonomy_version   text        NOT NULL,
        to_template_version   text        NOT NULL,
        status                text        NOT NULL,
        prior_values          jsonb       NOT NULL DEFAULT '[]'::jsonb,
        prior_inputs          jsonb       NOT NULL DEFAULT '[]'::jsonb,
        error                 text,
        migrated_at           timestamptz NOT NULL DEFAULT now(),
        decided_at            timestamptz,
        decided_by            uuid,
        FOREIGN KEY (report_id, organization_id) REFERENCES core.report (id, organization_id) ON DELETE CASCADE,
        CONSTRAINT report_migration_once_per_run UNIQUE (run_id, report_id),
        CONSTRAINT report_migration_status_known CHECK (status IN (
          'migrated', 'awaiting_review', 'accepted', 'declined', 'reverted', 'failed', 'skipped'
        )),
        CONSTRAINT report_migration_snapshots_are_lists CHECK (
          jsonb_typeof(prior_values) = 'array' AND jsonb_typeof(prior_inputs) = 'array'
        )
      )
    `);
    await queryRunner.query(`CREATE INDEX report_migration_report_idx ON core.report_migration (report_id)`);
    await queryRunner.query(`CREATE INDEX report_migration_run_idx ON core.report_migration (run_id)`);

    await queryRunner.query(`ALTER TABLE core.report_migration ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE core.report_migration FORCE ROW LEVEL SECURITY`);
    const bound = `organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid`;
    await queryRunner.query(`CREATE POLICY report_migration_select ON core.report_migration FOR SELECT USING (${bound})`);
    await queryRunner.query(`CREATE POLICY report_migration_insert ON core.report_migration FOR INSERT WITH CHECK (${bound})`);
    await queryRunner.query(
      `CREATE POLICY report_migration_update ON core.report_migration FOR UPDATE USING (${bound}) WITH CHECK (${bound})`,
    );

    await queryRunner.query(`GRANT SELECT, INSERT ON core.report_migration TO esg_worker`);
    // A retry fills a failed row in place (the run's key is one row per report), so the worker may write its snapshot.
    await queryRunner.query(`
      GRANT UPDATE (status, error, migrated_at, prior_values, prior_inputs, from_taxonomy_version, from_template_version)
        ON core.report_migration TO esg_worker
    `);
    await queryRunner.query(`GRANT SELECT ON core.report_migration TO esg_app, esg_admin_ro`);
    await queryRunner.query(`GRANT UPDATE (status, decided_at, decided_by) ON core.report_migration TO esg_app`);

    await queryRunner.query(`
      CREATE FUNCTION core.guard_report_migration() RETURNS trigger
        LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp AS $$
      BEGIN
        IF OLD.status <> 'failed' AND (
             NEW.prior_values IS DISTINCT FROM OLD.prior_values
          OR NEW.prior_inputs IS DISTINCT FROM OLD.prior_inputs
          OR NEW.from_taxonomy_version IS DISTINCT FROM OLD.from_taxonomy_version
          OR NEW.from_template_version IS DISTINCT FROM OLD.from_template_version
        ) THEN
          RAISE EXCEPTION 'a migrated report''s retained state is written once';
        END IF;
        IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
             (OLD.status = 'failed' AND NEW.status IN ('migrated', 'awaiting_review', 'skipped', 'failed'))
          OR (OLD.status = 'awaiting_review' AND NEW.status IN ('accepted', 'declined', 'reverted'))
          OR (OLD.status = 'migrated' AND NEW.status = 'reverted')
        ) THEN
          RAISE EXCEPTION 'a report migration does not move from % to %', OLD.status, NEW.status;
        END IF;
        RETURN NEW;
      END
      $$
    `);
    await queryRunner.query(`
      CREATE TRIGGER guard_report_migration BEFORE UPDATE ON core.report_migration
        FOR EACH ROW EXECUTE FUNCTION core.guard_report_migration()
    `);

    // The answer is one of four words: restored, not_found, not_restorable, locked.
    await queryRunner.query(`
      CREATE FUNCTION core.restore_report_migration(target uuid, decided_by_account uuid, outcome text)
        RETURNS text
        LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
      DECLARE
        -- Not "found": that name shadows PL/pgSQL's FOUND, and IF NOT FOUND would test the row.
        migration core.report_migration%ROWTYPE;
        report_row core.report%ROWTYPE;
        caller text := current_setting('app.current_user', true);
        prior jsonb;
      BEGIN
        IF outcome NOT IN ('declined', 'reverted') THEN
          RAISE EXCEPTION 'a restored migration is declined or reverted, not %', outcome;
        END IF;

        SELECT m.* INTO migration
          FROM core.report_migration m
         WHERE m.id = target
           AND m.organization_id = NULLIF(current_setting('app.current_org', true), '')::uuid
         FOR UPDATE;
        IF NOT FOUND THEN
          RETURN 'not_found';
        END IF;
        IF NOT ((outcome = 'declined' AND migration.status = 'awaiting_review')
             OR (outcome = 'reverted' AND migration.status IN ('migrated', 'awaiting_review'))) THEN
          RETURN 'not_restorable';
        END IF;

        SELECT r.* INTO report_row FROM core.report r WHERE r.id = migration.report_id FOR UPDATE;
        IF report_row.taxonomy_version <> migration.to_taxonomy_version
           OR report_row.template_version <> migration.to_template_version THEN
          RETURN 'not_restorable';
        END IF;
        IF report_row.status = 'locked' THEN
          RETURN 'locked';
        END IF;

        DELETE FROM core.report_disclosure_value WHERE report_id = migration.report_id;
        FOR prior IN SELECT value FROM jsonb_array_elements(migration.prior_values) LOOP
          -- An override's person is named by the trigger from this binding; bind theirs for its insert.
          PERFORM set_config('app.current_user', coalesce(prior ->> 'overridden_by', ''), true);
          INSERT INTO core.report_disclosure_value
            SELECT * FROM jsonb_populate_record(NULL::core.report_disclosure_value, prior);
        END LOOP;
        PERFORM set_config('app.current_user', coalesce(caller, ''), true);

        DELETE FROM core.report_derivation_input WHERE report_id = migration.report_id;
        INSERT INTO core.report_derivation_input
          SELECT * FROM jsonb_populate_recordset(NULL::core.report_derivation_input, migration.prior_inputs);

        UPDATE core.report
           SET taxonomy_version = migration.from_taxonomy_version,
               template_version = migration.from_template_version,
               updated_at = now()
         WHERE id = migration.report_id;

        UPDATE core.report_migration
           SET status = outcome, decided_at = now(), decided_by = decided_by_account
         WHERE id = migration.id;
        RETURN 'restored';
      END
      $$
    `);
    await queryRunner.query(`REVOKE ALL ON FUNCTION core.restore_report_migration(uuid, uuid, text) FROM PUBLIC`);
    await queryRunner.query(
      `GRANT EXECUTE ON FUNCTION core.restore_report_migration(uuid, uuid, text) TO esg_app, esg_worker`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP FUNCTION core.restore_report_migration(uuid, uuid, text)`);
    await queryRunner.query(`DROP TRIGGER guard_report_migration ON core.report_migration`);
    await queryRunner.query(`DROP FUNCTION core.guard_report_migration()`);
    // Lossy by necessity: the retained states go with the table that held them.
    await queryRunner.query(`DROP TABLE core.report_migration`);
  }
}
