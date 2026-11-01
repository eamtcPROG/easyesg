import { Injectable } from '@nestjs/common';
import { isLocale } from '@easyesg/i18n';
import { EXPORT_STATUS, isExportFormat } from '@api/modules/core/export/constants/export.constants';
import type { ExportArtifactStore } from '@api/modules/core/export/interfaces/export-artifact-store.interface';
import type { RequestedExport } from '@api/modules/core/export/models/requested-export.model';
import { displayName } from '@api/modules/identity/account/domain/display-name';
import { TenantRepository } from '../tenant-repository';

interface RequestedExportRow {
  id: string;
  report_id: string;
  format: string;
  locale: string;
  requested_by: string;
  requested_at: Date;
  entity_name: string;
  fiscal_year: number;
  requester_found: boolean;
  requester_email: string | null;
  requester_given_name: string | null;
  requester_family_name: string | null;
}

/**
 * `ExportArtifactStore` over `core.export_artifact` (task 44.2), on the export job's tenant unit of work.
 *
 * **Every statement names the status it expects**, beside the table's own policy, which admits an update of a row only
 * while it is `requested`: a settled record reads as none and is written by nothing, so a second job for one export
 * is a no-op rather than a second file.
 *
 * **The requester is named as every attribution is** — a `LEFT JOIN` on `identity.account`, UX-137's `displayName`
 * derived here and never stored (`overriding-person.ts`'s rule) — so an erased account reads as no name.
 */
@Injectable()
export class ExportArtifactStoreRepository extends TenantRepository<never> implements ExportArtifactStore {
  protected readonly entity = 'core.export_artifact' as never;

  async findRequested(query: { readonly exportId: string }): Promise<RequestedExport | null> {
    const rows = await this.manager.query<RequestedExportRow[]>(
      `SELECT e.id, e.report_id, e.format, e.locale, e.requested_by, e.requested_at,
              entity.name AS entity_name, period.fiscal_year,
              requester.id IS NOT NULL AS requester_found, requester.email AS requester_email,
              requester.given_name AS requester_given_name, requester.family_name AS requester_family_name
         FROM core.export_artifact e
         JOIN core.report report ON report.id = e.report_id
         JOIN core.reporting_period period ON period.id = report.reporting_period_id
         JOIN core.reporting_entity entity ON entity.id = period.reporting_entity_id
    LEFT JOIN identity.account requester ON requester.id = e.requested_by
        WHERE e.id = $1 AND e.status = $2`,
      [query.exportId, EXPORT_STATUS.REQUESTED],
    );
    const row = rows[0];
    if (row === undefined) return null;
    if (!isLocale(row.locale)) throw new Error(`Export ${row.id} names a language the platform does not register.`);
    if (!isExportFormat(row.format)) throw new Error(`Export ${row.id} names a format the platform does not produce.`);
    return {
      id: row.id,
      reportId: row.report_id,
      format: row.format,
      locale: row.locale,
      requestedBy:
        row.requester_found && row.requester_email !== null
          ? displayName(
              { givenName: row.requester_given_name, familyName: row.requester_family_name },
              row.requester_email,
            )
          : null,
      requestedById: row.requested_by,
      requestedAt: row.requested_at,
      subject: { entityName: row.entity_name, fiscalYear: row.fiscal_year },
    };
  }

  async complete(command: {
    readonly exportId: string;
    readonly generatedAt: Date;
    readonly objectKey: string;
    readonly byteSize: number;
    readonly sha256: string;
  }): Promise<void> {
    await this.manager.query(
      `UPDATE core.export_artifact
          SET status = $2, generated_at = $3, completed_at = now(), object_key = $4, byte_size = $5, sha256 = $6
        WHERE id = $1 AND status = $7`,
      [
        command.exportId,
        EXPORT_STATUS.COMPLETED,
        command.generatedAt,
        command.objectKey,
        command.byteSize,
        command.sha256,
        EXPORT_STATUS.REQUESTED,
      ],
    );
  }

  async fail(command: { readonly exportId: string; readonly failure: string }): Promise<void> {
    await this.manager.query(
      `UPDATE core.export_artifact SET status = $2, failed_at = now(), failure = $3 WHERE id = $1 AND status = $4`,
      [command.exportId, EXPORT_STATUS.FAILED, command.failure, EXPORT_STATUS.REQUESTED],
    );
  }
}
