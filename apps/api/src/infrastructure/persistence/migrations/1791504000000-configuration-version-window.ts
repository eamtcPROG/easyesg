import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Each configuration version records the window it was published for (task 37.2; `architecture.md` §12.5.6's task-37
 * row, project owner, 1 Oct 2026).
 *
 * **Revert crossed windows, and an effective-dated artefact is the case that exposes it.** `ConfigurationPublisher`
 * reverted by moving *every* slot of a scope that held a later revision back to the target — correct while every
 * reverted artefact held one unbounded slot, wrong the moment a scope holds two windows. An emission factor set is
 * such a scope (FR-71): a 2026 window and a 2027 window, and reverting a correction to the 2026 set would have put the
 * 2026 factors in force for 2027 too, which is two windows' figures resting on one window's factors with nothing
 * failing. The version table held no validity at all (task 16), so which slot a revision belonged to was not a fact the
 * store kept; this column is that fact, written by the publication that puts the version in force.
 *
 * **Immutable like the rest of a published version.** `config.reject_published_edit()` gains the column in the one
 * transition it permits, so a published or superseded version's window cannot move afterwards — a version whose
 * window could be edited could be reverted into a slot it never held.
 *
 * **Nullable, and the backfill is honest about what it cannot know.** A version in force in exactly one slot takes that
 * slot's window; a version of a scope that has only ever had one slot takes it too, since a single-window scope's
 * every revision was published into it and the seed loader refuses to reshape a live schedule. Anything else — a
 * superseded version of a scope that holds several windows — has no recorded window and stays `NULL`, and a revert to
 * it is refused rather than guessed. No production row predates this (deploy is tasks 71 … 73).
 *
 * No grant: `esg_app`, `esg_worker` and `esg_admin_ro` hold table-level privileges on `config.entry_version`, which
 * cover a new column.
 */
export class ConfigurationVersionWindow1791504000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE config.entry_version ADD COLUMN validity daterange`);

    await backfillVersionWindows(queryRunner);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION config.reject_published_edit() RETURNS trigger
        LANGUAGE plpgsql AS $fn$
      BEGIN
        IF TG_OP = 'DELETE' THEN
          RAISE EXCEPTION
            'configuration version %/% revision % is % and cannot be deleted',
            OLD.kind, OLD.scope, OLD.revision, OLD.state;
        END IF;

        IF OLD.state = 'published' AND NOT (
             NEW.state = 'superseded'
             AND NEW.payload  IS NOT DISTINCT FROM OLD.payload
             AND NEW.kind     IS NOT DISTINCT FROM OLD.kind
             AND NEW.scope    IS NOT DISTINCT FROM OLD.scope
             AND NEW.revision IS NOT DISTINCT FROM OLD.revision
             AND NEW.validity IS NOT DISTINCT FROM OLD.validity) THEN
          RAISE EXCEPTION
            'configuration version %/% revision % is published and immutable; publish a successor',
            OLD.kind, OLD.scope, OLD.revision;
        END IF;

        IF OLD.state = 'superseded' THEN
          RAISE EXCEPTION
            'configuration version %/% revision % is superseded and immutable',
            OLD.kind, OLD.scope, OLD.revision;
        END IF;

        RETURN NEW;
      END
      $fn$
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Task 16's body, restored before the column it would otherwise name is dropped.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION config.reject_published_edit() RETURNS trigger
        LANGUAGE plpgsql AS $fn$
      BEGIN
        IF TG_OP = 'DELETE' THEN
          RAISE EXCEPTION
            'configuration version %/% revision % is % and cannot be deleted',
            OLD.kind, OLD.scope, OLD.revision, OLD.state;
        END IF;

        IF OLD.state = 'published' AND NOT (
             NEW.state = 'superseded'
             AND NEW.payload  IS NOT DISTINCT FROM OLD.payload
             AND NEW.kind     IS NOT DISTINCT FROM OLD.kind
             AND NEW.scope    IS NOT DISTINCT FROM OLD.scope
             AND NEW.revision IS NOT DISTINCT FROM OLD.revision) THEN
          RAISE EXCEPTION
            'configuration version %/% revision % is published and immutable; publish a successor',
            OLD.kind, OLD.scope, OLD.revision;
        END IF;

        IF OLD.state = 'superseded' THEN
          RAISE EXCEPTION
            'configuration version %/% revision % is superseded and immutable',
            OLD.kind, OLD.scope, OLD.revision;
        END IF;

        RETURN NEW;
      END
      $fn$
    `);
    await queryRunner.query(`ALTER TABLE config.entry_version DROP COLUMN validity`);
  }
}

/**
 * This migration's data step (task 164's rule): each existing version's window, where the schedule can say it. Exported
 * so `test/migration-data-steps.e2e-spec.ts` can run it against rows; the SQL is the migration's own.
 *
 * **The immutability trigger is lifted around it**, because every row it writes is published or superseded and the
 * trigger refuses any change to one — the guarantee the backfill must go around rather than through, as the owner, once.
 * `config.*` carries no row-level security, so nothing else is lifted.
 */
export async function backfillVersionWindows(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query(`ALTER TABLE config.entry_version DISABLE TRIGGER reject_published_edit`);

  // A version in force in exactly one slot was published into it. One in force in several is the cross-window revert
  // this migration exists to stop, and which of its slots it was published for is no longer knowable.
  await queryRunner.query(`
      UPDATE config.entry_version v
         SET validity = s.validity
        FROM config.entry_schedule s
       WHERE s.version_id = v.id
         AND v.validity IS NULL
         AND (SELECT count(*) FROM config.entry_schedule o WHERE o.version_id = v.id) = 1
    `);

  // A scope that holds one slot has only ever held that one, so each of its superseded versions was published into it.
  await queryRunner.query(`
      UPDATE config.entry_version v
         SET validity = only_slot.validity
        FROM (SELECT kind, scope, (array_agg(validity))[1] AS validity
                FROM config.entry_schedule
               GROUP BY kind, scope
              HAVING count(*) = 1) only_slot
       WHERE only_slot.kind = v.kind
         AND only_slot.scope = v.scope
         AND v.validity IS NULL
    `);

  await queryRunner.query(`ALTER TABLE config.entry_version ENABLE TRIGGER reject_published_edit`);
}
