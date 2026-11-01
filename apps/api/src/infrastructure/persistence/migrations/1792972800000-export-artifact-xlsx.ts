import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * An export record may be an Excel file (task 46.1; FR-50, FR-53): `core.export_artifact.format` admits `xlsx` beside
 * `pdf`, the `CHECK` that `EXPORT_FORMAT` mirrors. Nothing else of the record changes — its digest, its object key and
 * its settlement are the PDF's, by `runExportAttempt`'s one rule.
 *
 * **The revert narrows the check `NOT VALID`** rather than deleting the Excel records a revert would otherwise be
 * refused over: an export kept for the organization's life (182/126) is evidence a schema revert must not destroy, and a
 * `NOT VALID` constraint holds every new row to the narrower set while leaving the ones already filed as they are.
 */
export class ExportArtifactXlsx1792972800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE core.export_artifact
        DROP CONSTRAINT export_artifact_format_known,
        ADD CONSTRAINT export_artifact_format_known CHECK (format IN ('pdf', 'xlsx'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE core.export_artifact
        DROP CONSTRAINT export_artifact_format_known,
        ADD CONSTRAINT export_artifact_format_known CHECK (format IN ('pdf')) NOT VALID
    `);
  }
}
