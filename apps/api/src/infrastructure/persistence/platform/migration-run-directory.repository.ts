import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { COMPATIBILITY } from '@api/modules/platform/taxonomy/domain/version-mapping';
import type {
  MigrationRunDirectory,
  RunToExecute,
} from '@api/modules/platform/taxonomy/interfaces/migration-run-directory.interface';
import { CORE_DATA_SOURCE } from '../data-source';

/**
 * `MIGRATION_RUN_DIRECTORY` (task 67.24) — the worker's reads with **no organization bound**: the run, a platform row
 * with no row security, and each selected report's organization under `report_worker_directory_select` (task 51.2's
 * policy, which holds only while nothing is bound). One of the named exceptions to `TenantRepository`, as
 * `FactorSetUsersRepository` is, for the same reason: it answers which organizations to bind.
 */
@Injectable()
export class MigrationRunDirectoryRepository implements MigrationRunDirectory {
  constructor(@InjectDataSource(CORE_DATA_SOURCE) private readonly dataSource: DataSource) {}

  async run(input: { readonly id: string }): Promise<RunToExecute | null> {
    const [row] = await this.dataSource.query<
      {
        id: string;
        from_taxonomy_version: string;
        to_taxonomy_version: string;
        to_template_version: string;
        determination: string;
        report_ids: string[];
        reverted_at: Date | null;
      }[]
    >(
      `SELECT id, from_taxonomy_version, to_taxonomy_version, to_template_version, determination, report_ids, reverted_at
         FROM config.migration_run WHERE id = $1`,
      [input.id],
    );
    if (row === undefined) return null;
    return {
      id: row.id,
      from: row.from_taxonomy_version,
      to: row.to_taxonomy_version,
      toTemplateVersion: row.to_template_version,
      determination: row.determination === COMPATIBILITY.BREAKING ? COMPATIBILITY.BREAKING : COMPATIBILITY.COMPATIBLE,
      reportIds: row.report_ids,
      reverted: row.reverted_at !== null,
    };
  }

  async organizationsOf(input: { readonly reportIds: readonly string[] }): Promise<
    readonly { readonly organizationId: string; readonly reportIds: readonly string[] }[]
  > {
    const rows = await this.dataSource.query<{ id: string; organization_id: string }[]>(
      `SELECT id, organization_id FROM core.report WHERE id = ANY($1::uuid[]) ORDER BY organization_id, id`,
      [input.reportIds],
    );
    const byOrganization = new Map<string, string[]>();
    for (const row of rows) byOrganization.set(row.organization_id, [...(byOrganization.get(row.organization_id) ?? []), row.id]);
    return [...byOrganization.entries()].map(([organizationId, reportIds]) => ({ organizationId, reportIds }));
  }
}
