import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * S-09's monthly form: an invoice line entered as twelve month figures whose sum is its quantity (task 39.1; FR-33;
 * `architecture.md` §12.5.6's task-39 row (1), project owner, 7 Oct 2026 — the shape the task-38.1 row (3) stated
 * and deferred).
 *
 * **One array column on the line, not a table of month rows.** The line is written whole — one `PUT`, one upsert, one
 * entry in the field trail — and the months are part of what that write says, so they share its row, its row-level
 * security, FR-22's lock trigger and FR-54's capture with nothing added. A child table would be a second write to keep
 * atomic with the first and a second set of policies and triggers that could drift from the line's.
 *
 * **The quantity stays the column a run copies**, so `core.calc_input` and everything that reads it are unchanged: a
 * monthly line carries its sum in `quantity`, which the run retains like any other figure. **The sum is held by a
 * `CHECK`**, not by the application's care: `core.calc_months_total` adds the months entered, and a line whose
 * quantity is not that sum is refused, so the two can never disagree in a stored row. A month left empty is a `NULL`
 * element — flagged on screen, never refused (the row's *"flags a missing month rather than quietly summing
 * eleven"*) — but at least one month must hold a figure, which the total being non-null is.
 *
 * **Twelve, by position from the period's start month.** Which calendar month each element stands for is the period's
 * business and is computed where it is shown; a period that does not span twelve calendar months is refused months by
 * the use case, since the period's dates can be edited and a constraint here could not see them.
 *
 * Expand-only: a nullable column and constraints every existing row satisfies, since no row holds months yet.
 */
export class CalculatorMonthlyQuantities1792022400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // The months entered, summed — NULL where none is, so an all-empty form is no figure rather than zero. Exact:
    // `numeric` addition, never a float. `search_path` empty, as a function a constraint calls must not resolve
    // names through the caller's path.
    await queryRunner.query(`
      CREATE FUNCTION core.calc_months_total(months numeric[]) RETURNS numeric
        LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
        SET search_path = ''
        AS $$ SELECT sum(m) FROM unnest(months) AS m $$
    `);

    await queryRunner.query(`
      ALTER TABLE core.calc_source
        ADD COLUMN monthly_quantities numeric[],
        -- Twelve, one dimension, counted from one: the form's rows and nothing else.
        ADD CONSTRAINT calc_source_months_twelve CHECK (
          monthly_quantities IS NULL
          OR (array_ndims(monthly_quantities) = 1 AND array_lower(monthly_quantities, 1) = 1
              AND cardinality(monthly_quantities) = 12)
        ),
        -- An empty month is NULL and passes; a negative figure is a mistyped bill, as on the line itself.
        ADD CONSTRAINT calc_source_months_non_negative CHECK (
          monthly_quantities IS NULL OR 0 <= ALL (monthly_quantities)
        ),
        -- The line's quantity IS the months' sum. COALESCE, because a comparison with an all-empty form's NULL total
        -- would be NULL — and a NULL check passes.
        ADD CONSTRAINT calc_source_months_total CHECK (
          monthly_quantities IS NULL
          OR COALESCE(quantity = core.calc_months_total(monthly_quantities), false)
        )
    `);
    await queryRunner.query(`GRANT UPDATE (monthly_quantities) ON core.calc_source TO esg_app`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE core.calc_source
        DROP CONSTRAINT calc_source_months_total,
        DROP CONSTRAINT calc_source_months_non_negative,
        DROP CONSTRAINT calc_source_months_twelve,
        DROP COLUMN monthly_quantities
    `);
    await queryRunner.query(`DROP FUNCTION core.calc_months_total(numeric[])`);
  }
}
