import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A template pin is EFRAG's release identifier — `1.3.0`, not `2026-05-01` (task 45.3; `architecture.md` §12.5.6's
 * task-45 row (1), project owner 11 Oct 2026).
 *
 * Until now a report's `template_version` held the taxonomy's date, written so by the adoption artefact, which made the
 * two dimensions DR-4 keeps apart one string twice. The owner chose EFRAG's own template release identifier, by
 * OQ-45's reasoning: EFRAG stamps it into the workbook, and a template fix released against an unchanged taxonomy —
 * `1.3.1` — must be pinnable apart from `1.3.0`, which a date cannot say. So the adoption windows now pin `1.2.0` and
 * `1.3.0`, and this renames what is already stored to match.
 *
 * **A rename, not a migration run.** Each stored date named exactly one template — the one EFRAG released against that
 * taxonomy, `1.2.0` against `2026-02-01` and `1.3.0` against `2026-05-01`, each confirmed from the workbook's own
 * entry point — so the pin changes spelling and not meaning, which is why FR-69's run, the act that moves a pin to
 * another version, is not what does it. Literal, as migration SQL is (`CLAUDE.md`): the pairing is frozen history.
 *
 * **Three tables, locked rows included.** The period determines the pin, the report copies it, and an export record
 * carries the one it was produced at (FR-53); all three must spell one version alike, or a later comparison of an
 * export's version with its report's would read a match as a mismatch. A locked period or report is renamed too, its
 * lock trigger lifted around the step: the lock keeps a filing's meaning from moving, and this moves its spelling
 * only. **`core.capture_field_change` stays on**, so the trail records each rename, with no actor — a migration's.
 */
export class TemplateReleasePins1792886400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await renameTemplatePinsToReleases(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await renameTemplatePinsToDates(queryRunner);
  }
}

/** The tables holding a template pin, and the trigger on each that refuses a write to a locked row. */
const PINNED = [
  { table: 'core.reporting_period', lock: 'refuse_locked_write' },
  { table: 'core.report', lock: 'refuse_locked_write' },
  { table: 'core.export_artifact', lock: null },
] as const;

/** `up`'s data step (task 164's rule): every stored date-shaped template pin to the release it names. */
export async function renameTemplatePinsToReleases(queryRunner: QueryRunner): Promise<void> {
  await renameTemplatePins(
    queryRunner,
    `CASE template_version WHEN '2026-02-01' THEN '1.2.0' WHEN '2026-05-01' THEN '1.3.0' END
      WHERE template_version IN ('2026-02-01', '2026-05-01')`,
  );
}

/** `down`'s data step: every release-shaped pin back to the date it was written as. */
export async function renameTemplatePinsToDates(queryRunner: QueryRunner): Promise<void> {
  await renameTemplatePins(
    queryRunner,
    `CASE template_version WHEN '1.2.0' THEN '2026-02-01' WHEN '1.3.0' THEN '2026-05-01' END
      WHERE template_version IN ('1.2.0', '1.3.0')`,
  );
}

/**
 * `FORCE` lifted around each table's statement, since the owner is subject to its policies and binds no organization —
 * under `FORCE` the statement would match nothing and say nothing — and the lock trigger with it.
 */
async function renameTemplatePins(queryRunner: QueryRunner, assignment: string): Promise<void> {
  for (const { table, lock } of PINNED) {
    await queryRunner.query(`ALTER TABLE ${table} NO FORCE ROW LEVEL SECURITY`);
    if (lock !== null) await queryRunner.query(`ALTER TABLE ${table} DISABLE TRIGGER ${lock}`);
    await queryRunner.query(`UPDATE ${table} SET template_version = ${assignment}`);
    if (lock !== null) await queryRunner.query(`ALTER TABLE ${table} ENABLE TRIGGER ${lock}`);
    await queryRunner.query(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
  }
}
