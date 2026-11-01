import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * FR-22 reaches a `DELETE` of a disclosure value (task 34.1's recorded hole, closed).
 *
 * **The hole.** `refuse_locked_write` covered `INSERT` and `UPDATE` and not `DELETE`, so a `DELETE`
 * of one value row inside a locked report was refused by nothing: `esg_app` holds `DELETE`, RLS
 * scoped it by tenant and not by lock, and there is no use case above the store. FR-22 as amended
 * says the lock *"refuses every write"*, so that contradicted it rather than narrowing it.
 *
 * **Why the hole existed, and why the reason did not survive being measured.** Task 34.1 carried
 * task 31.2's finding across: a `BEFORE DELETE` trigger fires during a referential cascade, and the
 * chain is organization → period → report → values, so covering `DELETE` would make a locked
 * report's organization undeletable. **That is true of 31.2's guard and false of this one**, and the
 * difference is which row the guard reads:
 *
 * - `core.reporting_period`'s guard reads **its own row** — `OLD.locked_at` — which is present in
 *   `OLD` whenever the trigger fires, cascade included. So it would indeed refuse the cascade.
 * - this guard reads **its parent**, `core.report.status`. PostgreSQL implements `ON DELETE CASCADE`
 *   as an `AFTER ROW` trigger on the *referenced* table, so by the time the child's trigger runs the
 *   parent row is already gone.
 *
 * Measured rather than reasoned, on a throwaway pair with this shape: a child `BEFORE DELETE`
 * trigger raising `NOTICE 'parent still visible: %'` during a cascade prints **`f`**. So the guard
 * simply cannot see a locked parent while cascading, and covering `DELETE` costs nothing.
 *
 * **Declined, having built it first: an RLS `DELETE` policy excluding locked rows.** It works — RI
 * actions bypass row security by documented guarantee, where they do not bypass triggers, and it was
 * implemented, applied and green. It was replaced because it is the more complex answer to a problem
 * that turned out not to exist: a `USING` clause *filters* rather than raises, so a refused delete
 * removed zero rows silently and the repository had to re-read the row to tell "refused" from "was
 * never there" — a second round trip, a second mechanism on one table, and a silent database refusal,
 * to avoid a cascade conflict that measurement showed was not there.
 */
export class LockedDisclosureDelete1789430400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // `NEW` is unassigned on DELETE and `OLD` on INSERT, so the row is chosen by `TG_OP` rather
    // than coalesced — referencing the absent one is a runtime error in plpgsql, and a plpgsql body
    // is not validated at creation, so it would surface on the first delete rather than here.
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

    await queryRunner.query(`DROP TRIGGER refuse_locked_write ON core.report_disclosure_value`);
    await queryRunner.query(`
      CREATE TRIGGER refuse_locked_write
        BEFORE INSERT OR UPDATE OR DELETE ON core.report_disclosure_value
        FOR EACH ROW EXECUTE FUNCTION core.refuse_locked_disclosure_write()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER refuse_locked_write ON core.report_disclosure_value`);
    await queryRunner.query(`
      CREATE TRIGGER refuse_locked_write
        BEFORE INSERT OR UPDATE ON core.report_disclosure_value
        FOR EACH ROW EXECUTE FUNCTION core.refuse_locked_disclosure_write()
    `);
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION core.refuse_locked_disclosure_write() RETURNS trigger
        LANGUAGE plpgsql AS $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM core.report r
           WHERE r.id = NEW.report_id AND r.status = 'locked'
        ) THEN
          RAISE EXCEPTION 'report % is locked', NEW.report_id USING ERRCODE = '45001';
        END IF;
        RETURN NEW;
      END;
      $$
    `);
  }
}
