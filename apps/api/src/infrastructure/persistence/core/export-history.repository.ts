import { Injectable } from '@nestjs/common';
import { isLocale, type Locale } from '@easyesg/i18n';
import { writeOutboxEvent } from '@api/infrastructure/outbox/outbox-writer';
import {
  EXPORT_REQUESTED_EVENT,
  isExportFormat,
  isExportStatus,
  type ExportFormat,
} from '@api/modules/core/export/constants/export.constants';
import type { ExportHistoryStore, StoredExport } from '@api/modules/core/export/interfaces/export-history.interface';
import type { ExportHistoryPage, ExportHistoryQuery } from '@api/modules/core/export/models/export-history-query.model';
import type { ExportRecord } from '@api/modules/core/export/models/export-record.model';
import { displayName } from '@api/modules/identity/account/domain/display-name';
import { TenantRepository } from '../tenant-repository';

interface ExportRow {
  id: string;
  report_id: string;
  format: string;
  locale: string;
  template_version: string;
  taxonomy_version: string;
  status: string;
  requested_at: Date;
  requested_by: string;
  requester_found: boolean;
  requester_email: string | null;
  requester_given_name: string | null;
  requester_family_name: string | null;
  completed_at: Date | null;
  failed_at: Date | null;
  /** `bigint`, which the driver answers as text. */
  byte_size: string | null;
  object_key: string | null;
  sha256: string | null;
}

/**
 * Every column a reader may see — **`failure` is not among them**: it is an operator's text, withheld from every
 * answer as it stands (task 44.2). The requester is named by the join an override's person is (`overriding-person.ts`):
 * the stored id carries no foreign key, so an erased account yields a requester with no name.
 */
const EXPORT_COLUMNS = `a.id, a.report_id, a.format, a.locale, a.template_version, a.taxonomy_version, a.status,
        a.requested_at, a.requested_by, requester.id IS NOT NULL AS requester_found, requester.email AS requester_email,
        requester.given_name AS requester_given_name, requester.family_name AS requester_family_name,
        a.completed_at, a.failed_at, a.byte_size::text AS byte_size, a.object_key, a.sha256`;

const EXPORT_FROM = `FROM core.export_artifact a LEFT JOIN identity.account requester ON requester.id = a.requested_by`;

/** The facets, each a no-op when it names nothing: `$2` formats, `$3` languages, `$4` taxonomy versions, `$5` statuses. */
const FACETS = `(cardinality($2::text[]) = 0 OR a.format = ANY($2::text[]))
            AND (cardinality($3::text[]) = 0 OR a.locale = ANY($3::text[]))
            AND (cardinality($4::text[]) = 0 OR a.taxonomy_version = ANY($4::text[]))
            AND (cardinality($5::text[]) = 0 OR a.status = ANY($5::text[]))`;

/** A row the `CHECK`s admit, read as the model — anything else is a schema the code no longer matches. */
function toRecord(row: ExportRow): ExportRecord {
  if (!isExportFormat(row.format) || !isLocale(row.locale) || !isExportStatus(row.status)) {
    throw new Error(`Export ${row.id} holds a format, language or status this code does not know`);
  }
  const name =
    row.requester_found && row.requester_email !== null
      ? displayName({ givenName: row.requester_given_name, familyName: row.requester_family_name }, row.requester_email)
      : null;
  return {
    id: row.id,
    reportId: row.report_id,
    format: row.format,
    locale: row.locale,
    templateVersion: row.template_version,
    taxonomyVersion: row.taxonomy_version,
    status: row.status,
    requestedAt: row.requested_at,
    requestedBy: { accountId: row.requested_by, name },
    completedAt: row.completed_at,
    failedAt: row.failed_at,
    byteSize: row.byte_size === null ? null : Number(row.byte_size),
  };
}

/**
 * The request tier's side of `core.export_artifact` (tasks 47.1, 47.4), on the request's transaction.
 *
 * **A request is the record and its outbox event together** (AD-6, P-8): the record's `INSERT … SELECT` takes the
 * organization from the report, its stamp trigger the requester and the versions (task 44.2), and the event — keyed by
 * the export's own id, which is also its job's — is written beside it, so a request that commits is a job that runs.
 */
@Injectable()
export class ExportHistoryRepository extends TenantRepository<never> implements ExportHistoryStore {
  protected readonly entity = 'core.export_artifact' as never;

  async request(command: {
    readonly exportId: string;
    readonly reportId: string;
    readonly format: ExportFormat;
    readonly locale: Locale;
  }): Promise<void> {
    await this.manager.query(
      `INSERT INTO core.export_artifact (id, organization_id, report_id, format, locale)
       SELECT $1, r.organization_id, r.id, $3, $4 FROM core.report r WHERE r.id = $2`,
      [command.exportId, command.reportId, command.format, command.locale],
    );
    await writeOutboxEvent(this.runner, {
      eventType: EXPORT_REQUESTED_EVENT[command.format],
      payload: { exportId: command.exportId },
      idempotencyKey: command.exportId,
    });
  }

  async list(query: ExportHistoryQuery): Promise<ExportHistoryPage> {
    const facets = [query.formats, query.locales, query.taxonomyVersions, query.statuses];
    const [counts] = await this.manager.query<{ total: number; matched: number }[]>(
      `SELECT count(*)::int AS total, (count(*) FILTER (WHERE ${FACETS}))::int AS matched
         FROM core.export_artifact a WHERE a.report_id = $1`,
      [query.reportId, ...facets],
    );
    const direction = query.newestFirst ? 'DESC' : 'ASC';
    const rows = await this.manager.query<ExportRow[]>(
      `SELECT ${EXPORT_COLUMNS} ${EXPORT_FROM}
        WHERE a.report_id = $1 AND ${FACETS}
        ORDER BY a.requested_at ${direction}, a.id ${direction}
        LIMIT $6 OFFSET $7`,
      [query.reportId, ...facets, query.take, query.skip],
    );
    return { records: rows.map(toRecord), matched: counts?.matched ?? 0, total: counts?.total ?? 0 };
  }

  async find(query: { readonly exportId: string }): Promise<StoredExport | null> {
    const [row] = await this.manager.query<ExportRow[]>(`SELECT ${EXPORT_COLUMNS} ${EXPORT_FROM} WHERE a.id = $1`, [
      query.exportId,
    ]);
    return row === undefined ? null : { record: toRecord(row), objectKey: row.object_key, sha256: row.sha256 };
  }
}
