import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * FR-24 … FR-32, FR-66 and FR-177 — the report (task 31.3; UC-17, UC-18).
 *
 * **The pin is the reason this table exists in this task, and it is protected by privilege rather
 * than by convention** (§12.5.6's task-31.3 rows). `esg_app` is granted `UPDATE` on `scope`,
 * `status` and `updated_at` and on nothing else, so the two version columns cannot be moved by
 * anything in the request tier — not by a repository, not by a route somebody adds in task 34, not
 * by a `psql` session holding the application's credentials. That is DR-6's own mechanism
 * (*append-only enforced by DB privileges*, §7.7) narrowed from a table to two columns, and it
 * costs nothing on the write path. FR-69's migration run grants itself the privilege in task 76's
 * own migration, which is exactly what *"nothing but an explicit migration moves them"* means.
 *
 * **The values are copied from the period, never resolved a second time.** `TAXONOMY_REGISTRY`'s
 * `pinFor()` is asked once, at period open, for the period's own start date (task 31.1). Asking it
 * again here would answer differently if an adoption were registered in between, and one filing
 * would carry two disagreeing pins with nothing failing — DR-4 defeated by the mechanism meant to
 * uphold it.
 *
 * **`scope` ships with the table rather than being migrated onto it** (D-A, P-11): it drives form
 * UI, validation and export, so a report table without it forces a migration over live reports.
 * Task 78.1 is not thereby done — its deliverable is the flag *driving* what a report contains, and
 * this is the column it drives from.
 */
export class Report1789257600000 implements MigrationInterface {
  /** §7.6's expression, identical to every other policy so they cannot drift apart. */
  private readonly boundOrganization = `NULLIF(current_setting('app.current_org', true), '')::uuid`;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE core.report (
        id                  uuid        PRIMARY KEY DEFAULT uuidv7(),
        organization_id     uuid        NOT NULL,
        reporting_period_id uuid        NOT NULL,

        -- D-A's report-level scope flag. Comprehensive is additive over Basic — the nine C1-C9
        -- disclosures on top of B1-B11 — never a different report (FR-177).
        scope               text        NOT NULL,

        -- The four states the prototypes draw (§12.5.6's task-31.3 row). Two are reachable today:
        -- open at creation, and locked written by the period lock, which is the ONLY writer of that
        -- half — FR-22's lock is a property of the period and this column is its shadow. The
        -- ready-to-file state arrives with task 41.3's completion roll-up and filed with task 47's
        -- export history; until then they are declared and unwritten, which is stated here rather
        -- than left to be discovered.
        status              text        NOT NULL DEFAULT 'open',

        -- DR-4, FR-66. Copied from the period at creation. NO RUNTIME ROLE MAY UPDATE THESE — see
        -- the grants below, which are the enforcement rather than a note about it.
        template_version    text        NOT NULL,
        taxonomy_version    text        NOT NULL,

        created_at          timestamptz NOT NULL DEFAULT now(),
        updated_at          timestamptz NOT NULL DEFAULT now(),

        CONSTRAINT report_scope_known
          CHECK (scope IN ('basic', 'basic_and_comprehensive')),
        CONSTRAINT report_status_known
          CHECK (status IN ('open', 'locked', 'ready_to_file', 'filed')),

        FOREIGN KEY (reporting_period_id, organization_id)
          REFERENCES core.reporting_period (id, organization_id) ON DELETE CASCADE,

        -- AT MOST ONE REPORT PER PERIOD, which is what lets the report reach FR-18's entity
        -- snapshot through its period instead of carrying a second copy of the id (§12.5.6's
        -- task-31.1 row). Leading with organization_id because every RLS-filtered scan predicates
        -- on it (§7.3's third structural note), and the uniqueness is not weakened by the extra
        -- column: the composite foreign key above ties organization_id to the period's, so two
        -- reports naming one period necessarily agree on the organization and collide here.
        UNIQUE (organization_id, reporting_period_id),

        -- §7.3's composite-FK target, for task 34's core.report_disclosure_value.
        UNIQUE (id, organization_id)
      )
    `);

    // No further index, and that is measured rather than assumed. Both unique constraints above
    // create a btree, and between them every read on this table is index-scannable: with
    // `SET enable_seqscan = off` the entity-filtered list plans as an index scan on
    // `report_organization_id_reporting_period_id_key` joined to the period's primary key, and the
    // single-report read plans as an index scan too.
    //
    // **Which of the two the planner picks is not determined at these sizes, and that is the point
    // of asking the question this way** (`apps/api/CLAUDE.md`): at ≤2,500 reports a year it prefers
    // a sequential scan for all of them anyway, so "is it used today" is the wrong question and "is
    // it usable" is the right one. A third index — on `status`, for S-06's filter — would cost every
    // write to save a filter over a set that fits on one page.

    // ── The pin's protection, below the application (P-4, DR-6) ────────────────────────────────
    //
    // **`UPDATE` is granted per column and the two pins are not in the list.** PostgreSQL's
    // column-level privileges are what make "the pin never moves silently" a property of the
    // database rather than of whoever writes the next repository. `INSERT` stays table-wide, which
    // is correct: the pin is *set* at creation and only then.
    //
    // Adding a column to this table therefore means adding it here too, and
    // `schema-invariants.e2e-spec.ts` pins the whole set with `toEqual` so neither direction can
    // pass silently — a pin regaining `UPDATE`, or a new column shipping unwritable.
    await queryRunner.query(`GRANT SELECT, INSERT, DELETE ON core.report TO esg_app`);
    await queryRunner.query(`GRANT UPDATE (scope, status, updated_at) ON core.report TO esg_app`);
    await queryRunner.query(`GRANT SELECT ON core.report TO esg_worker, esg_admin_ro`);

    await queryRunner.query(`ALTER TABLE core.report ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE core.report FORCE ROW LEVEL SECURITY`);
    for (const statement of [
      `CREATE POLICY report_tenant_select ON core.report
         FOR SELECT USING (organization_id = ${this.boundOrganization})`,
      `CREATE POLICY report_tenant_insert ON core.report
         FOR INSERT WITH CHECK (organization_id = ${this.boundOrganization})`,
      `CREATE POLICY report_tenant_update ON core.report
         FOR UPDATE USING (organization_id = ${this.boundOrganization})
                 WITH CHECK (organization_id = ${this.boundOrganization})`,
      `CREATE POLICY report_tenant_delete ON core.report
         FOR DELETE USING (organization_id = ${this.boundOrganization})`,
    ]) {
      await queryRunner.query(statement);
    }

    // ── FR-22's lock, reaching the report ──────────────────────────────────────────────────────
    //
    // The period's own trigger (task 31.2) guards the period shell; this guards the report inside
    // it, for the same reason: the application check produces a message a person can act on, and
    // this is what makes the guarantee independent of every future writer remembering it.
    //
    // **While locked, only `status` may move.** It is stated as a row comparison rather than a
    // column list so a column added in task 34 is covered the day it is added. It permits exactly
    // the writes the lifecycle needs — the period's reopen moving locked back to open, and task
    // 47's filed — and refuses everything else, `scope` included, which is what stops a
    // Comprehensive upgrade landing inside a locked period as ordinary editing (UC-58's rule that
    // an amendment must be visible as one).
    //
    // SQLSTATE `45001` is the one task 31.2 chose, for its reason: class 45 is left to
    // applications by the standard, so a repository can recognise this refusal rather than meeting
    // every plpgsql error in the schema as the same 500.
    await queryRunner.query(`
      CREATE FUNCTION core.refuse_locked_report_write() RETURNS trigger
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
    // `UPDATE` only, and `DELETE` deliberately not — task 31.2's own note explains why at length: a
    // row that ceases to exist has not been amended, and covering DELETE there made a locked
    // period's **organization** undeletable through the cascade. The same cascade reaches here.
    //
    // `WHEN (OLD.status = 'locked')` keeps the function out of the path for every write to every
    // report that is not locked, which is nearly all of them.
    await queryRunner.query(`
      CREATE TRIGGER refuse_locked_write
        BEFORE UPDATE ON core.report
        FOR EACH ROW WHEN (OLD.status = 'locked')
        EXECUTE FUNCTION core.refuse_locked_report_write()
    `);

    // FR-54's per-field capture. The pins are the columns this matters most for — DR-4's guarantee
    // is that they never move silently, and the trail is what makes "silently" checkable after the
    // fact even now that the privilege makes the move unreachable from the request tier.
    await queryRunner.query(`
      CREATE TRIGGER capture_field_change
        AFTER INSERT OR UPDATE OR DELETE ON core.report
        FOR EACH ROW EXECUTE FUNCTION core.capture_field_change('organization_id', 'updated_at')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE core.report`);
    await queryRunner.query(`DROP FUNCTION core.refuse_locked_report_write()`);
  }
}
