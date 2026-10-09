import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * One reporting period per fiscal year for each entity (task 186; FR-21 behaviour 4; `architecture.md` §12.5.6's
 * task-186 row and the task-182 identity and organization row, 182/10).
 *
 * **This reverses task 31.1's deliberate omission.** That migration left `(reporting_entity_id, fiscal_year)` non-unique
 * so that a short transition period and a new full one could carry one label; the project owner chose on 5 Oct 2026 to
 * forbid a repeated year everywhere, because S-14 already refused to offer one and the api accepted it. An undertaking
 * changing its fiscal year-end now labels its transition period with a different year. The no-overlap exclusion is
 * untouched: the two constraints answer different questions, and each refuses rows the other admits.
 *
 * **The key is the entity and the year, without the organization**: an entity's id is unique across organizations,
 * so adding `organization_id` would constrain nothing more. **No index is added for the use case's read**
 * (`ReportingPeriodStoreRepository.holdsFiscalYear`): measured with `enable_seqscan = off`, the planner reaches an
 * entity's handful of periods through the no-overlap GiST index, and this key's own index is usable for both columns
 * where the other two are absent.
 *
 * **A repeated year already stored refuses the migration and changes nothing** (the task-186 row (1)). Which of two
 * filings carries the wrong label is the administrator's judgement, and a locked one cannot be rewritten without
 * lifting FR-22's trigger — so the step names what it found, and the administrator relabels on S-14 before the
 * migration runs again. PostgreSQL would refuse the constraint anyway; the step is what makes the refusal say what to do.
 *
 * `down` drops the constraint and restores task 31.1's schema exactly; it loses nothing.
 */
export class PeriodFiscalYearUnique1792627200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await refuseRepeatedFiscalYears(queryRunner);

    await queryRunner.query(`
      ALTER TABLE core.reporting_period
        ADD CONSTRAINT reporting_period_fiscal_year_unique UNIQUE (reporting_entity_id, fiscal_year)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE core.reporting_period DROP CONSTRAINT reporting_period_fiscal_year_unique`);
  }
}

interface RepeatedYearRow {
  reporting_entity_id: string;
  fiscal_year: number;
  period_ids: string[];
}

/**
 * `up`'s data step (task 164's rule): find every entity holding a fiscal year more than once and, if there is one,
 * stop the migration naming each. **`FORCE` is lifted around the read**, since the owner is subject to the table's
 * policies and binds no organization — without the pair the read matches no row, and the check passes on any database.
 * It is restored before the refusal is raised, so the step leaves the table as it found it either way.
 */
export async function refuseRepeatedFiscalYears(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query(`ALTER TABLE core.reporting_period NO FORCE ROW LEVEL SECURITY`);
  const repeated = (await queryRunner.query(`
    SELECT reporting_entity_id, fiscal_year, array_agg(id ORDER BY period_start, id) AS period_ids
      FROM core.reporting_period
     GROUP BY reporting_entity_id, fiscal_year
    HAVING count(*) > 1
     ORDER BY reporting_entity_id, fiscal_year
  `)) as RepeatedYearRow[];
  await queryRunner.query(`ALTER TABLE core.reporting_period FORCE ROW LEVEL SECURITY`);

  if (repeated.length === 0) return;
  const found = repeated
    .map((row) => `entity ${row.reporting_entity_id}, fiscal year ${row.fiscal_year}: periods ${row.period_ids.join(', ')}`)
    .join('; ');
  throw new Error(
    `An entity holds a fiscal year more than once, and a period's fiscal year is now unique per entity (FR-21, ` +
      `task 186). Nothing was changed. Give one period of each a different fiscal year on S-14 — reopening it first ` +
      `if it is locked — and run the migration again. Found: ${found}.`,
  );
}
