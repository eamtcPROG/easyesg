import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Where a disclosure value came from — task 36.4, for UC-21's calculated figures.
 *
 * B3's emissions are *"normally produced by the carbon calculator (UC-33) rather than typed
 * directly"* (UC-21's alternate flow), and a reporter looking at a filled field cannot otherwise
 * tell which it was. UX-12 and UX-43 both rest on that distinction: a derivation can only be
 * offered for a figure the system computed, and an override can only display a superseded value if
 * something records that one was superseded.
 *
 * **Three members, and only one is reachable today.** This follows `core.report.status`'s
 * precedent, and for its stated reason — a `CHECK` constraint is frozen history the day it ships,
 * so the vocabulary is declared once rather than migrated a member at a time:
 *
 * - `reported` — the reporter entered it. Every row today, and the default.
 * - `calculated` — task 39.2's return from the carbon calculator writes it.
 * - `overridden` — task 38.5's UC-34, where a reporter replaces a computed figure with a reason.
 *
 * **The cost of shipping it unproduced is real and was accepted deliberately** (project owner,
 * 8 Sep 2026): until 39.2 lands, nothing writes anything but `reported`, so the screen state that
 * marks a calculated field cannot be entered. That is the shape `READ_ONLY_CAUSE` refused for the
 * suspended-entitlement cause — *"a cause with no producer would be a screen state nothing can
 * enter"* — and it is taken here anyway so that B3's fields carry the seam 39.2 writes into rather
 * than growing one later. `architecture.md` §12.5.6 records the decision and what it buys.
 *
 * **`esg_app` may write it**, unlike `element_key` or `dimension_key`: the calculator's return and
 * an override are ordinary application writes, not identity. `schema-invariants.e2e-spec.ts`
 * declares what is withheld rather than what is granted, so this column is accounted for by being
 * absent from that list.
 *
 * No audit change: `core.capture_field_change` compares `jsonb` row images, so a column added here
 * is captured from the moment it exists — which is the whole reason task 14 wrote it that way.
 */
export class DisclosureValueOrigin1789603200000 implements MigrationInterface {
  name = 'DisclosureValueOrigin1789603200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE core.report_disclosure_value
        ADD COLUMN origin text NOT NULL DEFAULT 'reported',
        ADD CONSTRAINT report_disclosure_value_origin_known
          CHECK (origin IN ('reported', 'calculated', 'overridden'))
    `);

    await queryRunner.query(
      `GRANT UPDATE (origin) ON core.report_disclosure_value TO esg_app`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // The grant goes with the column; dropping the column drops it.
    await queryRunner.query(`
      ALTER TABLE core.report_disclosure_value
        DROP CONSTRAINT report_disclosure_value_origin_known,
        DROP COLUMN origin
    `);
  }
}
