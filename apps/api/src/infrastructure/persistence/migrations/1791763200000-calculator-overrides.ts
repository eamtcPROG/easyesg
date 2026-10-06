import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * UC-34 — a computed figure explained, or replaced with a reason (task 38.4, which took in 38.5; FR-36, UX-43;
 * `architecture.md` §12.5.6's task-38.4 row, project owner, 1 Oct 2026).
 *
 * **Two places a figure can be replaced, each where its figure lives.**
 *
 * - **A B3 figure** — Scope 1 or Scope 2 as a whole, the accountant's tonnes — on `core.report_disclosure_value`:
 *   origin `overridden`, and the reason in a new `explanation`. The same column holds an explanation of a figure that
 *   stands (`calculated`, an annotation), so one column serves both of UC-34's verbs. **An override without its reason
 *   is refused by a `CHECK`**, which is UX-43's *"an unexplained substituted figure shall never be presentable"* made a
 *   property of the row rather than of a form. The superseded computed figure is the run's own stored result
 *   (`core.calc_result`), retained permanently, so nothing is copied to keep it.
 * - **One invoice line's tonnes** — S-09's *"diesel for the van, your figure"* — on `core.calc_source`, with its reason,
 *   and copied into `core.calc_input` like the rest of the line: a run computes over the substituted figure, and its
 *   replay reproduces it, because the substitution is part of what the run retained. Only a measured line has a
 *   computed figure to replace, so only a measured line may carry one.
 *
 * No backfill: no row carries `overridden` before this — nothing could write it.
 */
export class CalculatorOverrides1791763200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE core.report_disclosure_value ADD COLUMN explanation text`);
    await queryRunner.query(`
      ALTER TABLE core.report_disclosure_value
        ADD CONSTRAINT report_disclosure_value_override_explained
        CHECK (origin <> 'overridden' OR (explanation IS NOT NULL AND btrim(explanation) <> ''))
    `);
    await queryRunner.query(`GRANT UPDATE (explanation) ON core.report_disclosure_value TO esg_app`);

    await queryRunner.query(`
      ALTER TABLE core.calc_source
        ADD COLUMN override_tonnes      numeric,
        ADD COLUMN override_explanation text,
        ADD CONSTRAINT calc_source_override_non_negative CHECK (override_tonnes >= 0),
        -- A substituted figure and its reason, or neither.
        ADD CONSTRAINT calc_source_override_explained CHECK (
          (override_tonnes IS NULL) = (override_explanation IS NULL)
          AND (override_explanation IS NULL OR btrim(override_explanation) <> '')
        ),
        -- Only a figure the calculator worked out can be replaced, and only a measured line has one.
        ADD CONSTRAINT calc_source_override_of_measured CHECK (override_tonnes IS NULL OR quantity IS NOT NULL)
    `);
    await queryRunner.query(`GRANT UPDATE (override_tonnes, override_explanation) ON core.calc_source TO esg_app`);

    // The run's copy, immutable like the rest of it: no grant beyond the INSERT the table already gives.
    await queryRunner.query(`
      ALTER TABLE core.calc_input
        ADD COLUMN override_tonnes      numeric,
        ADD COLUMN override_explanation text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE core.calc_input DROP COLUMN override_tonnes, DROP COLUMN override_explanation`);
    await queryRunner.query(`
      ALTER TABLE core.calc_source
        DROP CONSTRAINT calc_source_override_of_measured,
        DROP CONSTRAINT calc_source_override_explained,
        DROP CONSTRAINT calc_source_override_non_negative,
        DROP COLUMN override_tonnes,
        DROP COLUMN override_explanation
    `);
    await queryRunner.query(`
      ALTER TABLE core.report_disclosure_value
        DROP CONSTRAINT report_disclosure_value_override_explained,
        DROP COLUMN explanation
    `);
  }
}
