import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The validation rule set a lock pins (task 41.1; FR-73 item 9, NFR-87; `architecture.md` §12.5.6's task-41 row (5),
 * project owner, 8 Oct 2026).
 *
 * **A locked period's findings must not move under a later rule**, and the configuration store cannot hold a rule set
 * still by date: its publisher writes into an exact window and splits none, so a change to the seed's one unbounded
 * window replaces the set for every date — the lock day included. So the lock records **which revision** was in force
 * on its day, in the period's own zone, and a run on a locked report reads that revision by number, as a calculation
 * reads its pinned factor set (FR-35). A reopening clears it: a reopened period is open, and reads as at today.
 *
 * **Nullable, and a pin only beside a lock** (`reporting_period_rule_set_pin_needs_lock`). A period locked before this
 * migration carries none — nothing could be read at migration time, which runs before the seed — and is read as at
 * its lock day instead. No production row predates it (deploy is tasks 71 … 73).
 *
 * **The lock trigger is redefined to leave the pin out of the row it compares**, beside `locked_at` and `locked_by`.
 * Its rule is that a locked period's row does not change except by the lock's own columns, and the pin is one: without
 * the exclusion, a reopening — which clears the pin — would be refused as an edit to a locked period. The comparison
 * still refuses every other column, and a column added later is covered the day it is added.
 *
 * No grant: `esg_app` holds table-level `UPDATE` on `core.reporting_period`, which covers a new column.
 */
export class LockedRuleSet1792195200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE core.reporting_period
        ADD COLUMN locked_rule_set_revision integer,
        ADD CONSTRAINT reporting_period_rule_set_pin_needs_lock
          CHECK (locked_rule_set_revision IS NULL OR locked_at IS NOT NULL),
        ADD CONSTRAINT reporting_period_rule_set_pin_positive
          CHECK (locked_rule_set_revision > 0)
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION core.refuse_locked_period_write() RETURNS trigger
        LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.locked_at IS NOT NULL
           OR (to_jsonb(NEW) - 'locked_at' - 'locked_by' - 'locked_rule_set_revision' - 'updated_at')
              IS DISTINCT FROM
              (to_jsonb(OLD) - 'locked_at' - 'locked_by' - 'locked_rule_set_revision' - 'updated_at') THEN
          RAISE EXCEPTION 'reporting period % is locked', OLD.id USING ERRCODE = '45001';
        END IF;
        RETURN NEW;
      END;
      $$
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION core.refuse_locked_period_write() RETURNS trigger
        LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.locked_at IS NOT NULL
           OR (to_jsonb(NEW) - 'locked_at' - 'locked_by' - 'updated_at')
              IS DISTINCT FROM
              (to_jsonb(OLD) - 'locked_at' - 'locked_by' - 'updated_at') THEN
          RAISE EXCEPTION 'reporting period % is locked', OLD.id USING ERRCODE = '45001';
        END IF;
        RETURN NEW;
      END;
      $$
    `);
    await queryRunner.query(`
      ALTER TABLE core.reporting_period
        DROP CONSTRAINT reporting_period_rule_set_pin_positive,
        DROP CONSTRAINT reporting_period_rule_set_pin_needs_lock,
        DROP COLUMN locked_rule_set_revision
    `);
  }
}
