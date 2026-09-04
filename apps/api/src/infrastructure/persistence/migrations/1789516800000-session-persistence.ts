import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `identity.session.remembered` — the *Keep me signed in on this device* choice (S-01;
 * `architecture.md` §12.5.6 and OQ-35, amended 4 Sep 2026).
 *
 * **The column stores the CHOICE, never a deadline**, which is the rule `session-expiry.ts` already
 * states for the pair it computes from: *"a stored deadline would freeze the day's §12.5.6 policy
 * into every row, turning a register amendment into a data migration"*. The rows keep facts —
 * `created_at`, `issued_at`, and now this one — and the two lifetime pairs stay in the domain beside
 * their citation. A later amendment to either window therefore changes one constant and no data.
 *
 * **Existing rows are backfilled `true`, and new rows default `false`.** Both halves matter and they
 * pull in opposite directions, which is why the column is added with one default and then given
 * another rather than written in a single clause. Every session alive when this runs was issued
 * under OQ-35's original 7 d / 30 d policy; defaulting them to `false` would apply a 12 h cap
 * retroactively and sign every signed-in user out for a schema change. New rows go the other way:
 * an absent `remember` on the wire reads as *not remembered*, so a caller that forgets the field —
 * or a row written by a path nobody has updated — gets the safer window rather than the longer one.
 *
 * **The grant is narrowed in the same migration, because otherwise the sentence above is false.**
 * Task 21 granted `SELECT, INSERT, UPDATE` on `identity.session` **table-wide**, and a table-level
 * grant covers a column added later — so without this, `esg_app` could widen a session's window
 * after it was granted, and three comments in this change would be describing a property of nothing.
 * That is the shape `apps/api/CLAUDE.md` records under *"Withholding a column from the
 * application"*, and `core.report`'s DR-4 pins are its precedent: the policy decides which rows,
 * the grant decides which columns, and P-4 asks for the guarantee to sit below the application.
 *
 * `active_organization_id`, `revoked_at` and `revoked_reason` are the only columns the application
 * updates — verified against every `UPDATE identity.session` in the tree, of which there are four.
 * Everything else on the table is identity or a decision made once: `id`, `account_id`,
 * `created_at`, and now `remembered`. **`test/schema-invariants.e2e-spec.ts` declares the
 * withholding**, which is what makes a fifth column added later fail a gate rather than ship
 * unwritable.
 */
export class SessionPersistence1789516800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE identity.session ADD COLUMN remembered boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(`ALTER TABLE identity.session ALTER COLUMN remembered SET DEFAULT false`);

    await queryRunner.query(`REVOKE UPDATE ON identity.session FROM esg_app`);
    await queryRunner.query(
      `GRANT UPDATE (active_organization_id, revoked_at, revoked_reason)
         ON identity.session TO esg_app`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // The grant goes back table-wide before the column goes, which is the order that matters: a
    // column-level grant naming a column that no longer exists is not revocable afterwards.
    await queryRunner.query(
      `REVOKE UPDATE (active_organization_id, revoked_at, revoked_reason)
         ON identity.session FROM esg_app`,
    );
    await queryRunner.query(`GRANT UPDATE ON identity.session TO esg_app`);
    await queryRunner.query(`ALTER TABLE identity.session DROP COLUMN remembered`);
  }
}
