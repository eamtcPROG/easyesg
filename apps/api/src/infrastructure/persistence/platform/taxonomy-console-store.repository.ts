import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { DataSource } from 'typeorm';
import type { TaxonomyVersionMapping } from '@api/contracts/taxonomy-mapping.port';
import { ConfigurationPayloadRefusedError } from '@api/infrastructure/configuration/configuration-payload-refused.error';
import { ConfigurationPublisher } from '@api/infrastructure/configuration/configuration-publisher.service';
import { ConfigurationRevisionMismatchError } from '@api/infrastructure/configuration/configuration-revision-mismatch.error';
import { ConfigurationStore } from '@api/infrastructure/configuration/configuration-store.service';
import { parseSeedName } from '@api/infrastructure/configuration/seed-configuration';
import {
  REPORTING_TAXONOMY_CONFIG_KIND,
  VSME_DIGITAL_TEMPLATE_CONFIG_KIND,
  VSME_TAXONOMY_CONFIG_KIND,
  VSME_TAXONOMY_MAPPING_CONFIG_KIND,
} from '@api/modules/platform/taxonomy/constants/taxonomy.constants';
import { mappingScope, readVersionMapping } from '@api/modules/platform/taxonomy/domain/version-mapping';
import {
  TaxonomyAdoptionInvalidError,
  TaxonomyCandidateRefusedError,
  TaxonomyChangedError,
} from '@api/modules/platform/taxonomy/errors/taxonomy-console.errors';
import type { TaxonomyConsoleStore } from '@api/modules/platform/taxonomy/interfaces/taxonomy-console-store.interface';
import type {
  AdoptionWindow,
  StoredMapping,
  TaxonomyConsole,
  TaxonomyExposure,
} from '@api/modules/platform/taxonomy/models/taxonomy-console.model';
import { ACQUISITION_PURPOSE } from '@api/modules/platform/support-access/models/support-access-log.model';
import { AdminReadOnly } from '../admin-readonly';
import { CORE_DATA_SOURCE } from '../data-source';

/** The standard A-04 administers — one is registered (OQ-45), and its adoption schedule's scope is its name. */
const STANDARD = 'vsme';
const VERSION = /^\d{4}-\d{2}-\d{2}$/u;

/**
 * `config/taxonomy-candidates`, as `apps/api` sees it — `efragDirectory`'s convention. A version's artefacts are
 * extracted offline into `<version>/` there, named as seed files are, and registering one publishes them (182/48).
 */
export const candidatesDirectory = (): string => resolve(process.cwd(), '../../config/taxonomy-candidates');

/**
 * A-04's store (tasks 67.21, 67.22; §12.5.6's task-67.21 row) — the taxonomy artefacts read straight from
 * `config.entry_*`, as A-03's store reads its own, the committed candidates read from disk, and the exposure counted
 * through `esg_admin_ro`, logged first. **The store's errors become this module's refusals here**, and the cache is
 * polled after every publication so this replica pins the change at once.
 */
@Injectable()
export class TaxonomyConsoleStoreRepository implements TaxonomyConsoleStore {
  constructor(
    @InjectDataSource(CORE_DATA_SOURCE) private readonly dataSource: DataSource,
    private readonly publisher: ConfigurationPublisher,
    private readonly configurationStore: ConfigurationStore,
    private readonly adminReadOnly: AdminReadOnly,
  ) {}

  async state(): Promise<TaxonomyConsole> {
    const inForce = await this.dataSource.query<
      { kind: string; scope: string; revision: number; payload: Record<string, unknown>; starts: string | null; ends: string | null }[]
    >(
      `SELECT s.kind, s.scope, v.revision, v.payload, lower(s.validity)::text AS starts, upper(s.validity)::text AS ends
         FROM config.entry_schedule s JOIN config.entry_version v ON v.id = s.version_id
        WHERE s.kind = ANY($1::text[])
        ORDER BY s.kind, s.scope, lower(s.validity) NULLS FIRST`,
      [[VSME_TAXONOMY_CONFIG_KIND, VSME_DIGITAL_TEMPLATE_CONFIG_KIND, VSME_TAXONOMY_MAPPING_CONFIG_KIND, REPORTING_TAXONOMY_CONFIG_KIND]],
    );
    const of = (kind: string) => inForce.filter((row) => row.kind === kind);

    const registered = of(VSME_TAXONOMY_CONFIG_KIND).map((row) => row.scope);
    const versions = registered.map((version) => ({
      version,
      templateVersions: of(VSME_DIGITAL_TEMPLATE_CONFIG_KIND)
        .filter((row) => row.payload.taxonomyVersion === version)
        .map((row) => row.scope),
    }));
    const adoption = of(REPORTING_TAXONOMY_CONFIG_KIND)
      .filter((row) => row.scope === STANDARD)
      .flatMap((row): AdoptionWindow[] =>
        typeof row.payload.version === 'string' && typeof row.payload.templateVersion === 'string'
          ? [
              {
                validFrom: row.starts,
                validTo: row.ends,
                version: row.payload.version,
                templateVersion: row.payload.templateVersion,
                revision: row.revision,
              },
            ]
          : [],
      );
    const mappings = of(VSME_TAXONOMY_MAPPING_CONFIG_KIND).flatMap((row): StoredMapping[] => {
      const mapping = readVersionMapping(row.payload);
      return mapping === null ? [] : [{ ...mapping, revision: row.revision }];
    });
    const candidates = existsSync(candidatesDirectory())
      ? readdirSync(candidatesDirectory(), { withFileTypes: true })
          .filter((entry) => entry.isDirectory() && VERSION.test(entry.name) && !registered.includes(entry.name))
          .map((entry) => entry.name)
          .sort()
      : [];
    return { versions, candidates, adoption, mappings };
  }

  async registerCandidate(input: { readonly version: string; readonly operatorId: string }): Promise<{ readonly id: string } | null> {
    if (!VERSION.test(input.version)) return null;
    const directory = join(candidatesDirectory(), input.version);
    if (!existsSync(directory)) return null;
    const entries = readdirSync(directory)
      .sort()
      .flatMap((name) => {
        const parsed = parseSeedName(name);
        return parsed === null
          ? []
          : [{ ...parsed, payload: JSON.parse(readFileSync(join(directory, name), 'utf8')) as Record<string, unknown> }];
      });
    // A candidate is a taxonomy first: without its own artefact there is nothing to register.
    if (!entries.some((entry) => entry.kind === VSME_TAXONOMY_CONFIG_KIND && entry.scope === input.version)) return null;
    try {
      const set = await this.publisher.publishSet({ entries, actorId: input.operatorId });
      await this.configurationStore.poll();
      return { id: set.publicationId };
    } catch (error) {
      if (error instanceof ConfigurationPayloadRefusedError) throw new TaxonomyCandidateRefusedError();
      throw error;
    }
  }

  async publishMapping(input: {
    readonly mapping: TaxonomyVersionMapping;
    readonly expectedRevision: number;
    readonly operatorId: string;
  }): Promise<{ readonly id: string; readonly revision: number }> {
    try {
      const published = await this.publisher.publish({
        kind: VSME_TAXONOMY_MAPPING_CONFIG_KIND,
        scope: mappingScope(input.mapping),
        payload: { ...input.mapping, fields: input.mapping.fields.map((field) => ({ ...field })) },
        actorId: input.operatorId,
        expectedRevision: input.expectedRevision,
      });
      await this.configurationStore.poll();
      return published;
    } catch (error) {
      if (error instanceof ConfigurationRevisionMismatchError) throw new TaxonomyChangedError();
      throw error;
    }
  }

  async adopt(input: {
    readonly version: string;
    readonly templateVersion: string;
    readonly from: string;
    readonly expectedRevision: number;
    readonly operatorId: string;
  }): Promise<{ readonly id: string; readonly revision: number }> {
    try {
      const published = await this.publisher.openWindow({
        kind: REPORTING_TAXONOMY_CONFIG_KIND,
        scope: STANDARD,
        at: input.from,
        payload: { standard: STANDARD, version: input.version, templateVersion: input.templateVersion },
        actorId: input.operatorId,
        expectedRevision: input.expectedRevision,
      });
      await this.configurationStore.poll();
      return published;
    } catch (error) {
      if (error instanceof ConfigurationRevisionMismatchError) throw new TaxonomyChangedError();
      if (error instanceof ConfigurationPayloadRefusedError) throw new TaxonomyAdoptionInvalidError();
      throw error;
    }
  }

  exposure(input: { readonly newest: string; readonly requesterId: string }): Promise<TaxonomyExposure> {
    return this.adminReadOnly.acquire(
      { requesterId: input.requesterId, purpose: ACQUISITION_PURPOSE.TAXONOMY_EXPOSURE, organizationId: null },
      async (runner) => {
        // `esg_admin_ro` bypasses row security, so a deleted report is filtered here (task 192's note).
        const rows = (await runner.query(
          `SELECT r.organization_id, o.name, r.taxonomy_version AS version, count(*)::int AS reports
             FROM core.report r JOIN core.organization o ON o.id = r.organization_id
            WHERE r.deleted_at IS NULL AND r.taxonomy_version < $1
            GROUP BY r.organization_id, o.name, r.taxonomy_version
            ORDER BY o.name, r.organization_id, r.taxonomy_version`,
          [input.newest],
        )) as { organization_id: string; name: string; version: string; reports: number }[];

        const byVersion = new Map<string, { reports: number; organizations: Set<string> }>();
        const byOrganization = new Map<string, { name: string; versions: { version: string; reports: number }[] }>();
        for (const row of rows) {
          const version = byVersion.get(row.version) ?? { reports: 0, organizations: new Set<string>() };
          version.reports += row.reports;
          version.organizations.add(row.organization_id);
          byVersion.set(row.version, version);
          const organization = byOrganization.get(row.organization_id) ?? { name: row.name, versions: [] };
          organization.versions.push({ version: row.version, reports: row.reports });
          byOrganization.set(row.organization_id, organization);
        }
        return {
          newest: input.newest,
          versions: [...byVersion.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([version, totals]) => ({ version, reports: totals.reports, organizations: totals.organizations.size })),
          organizations: [...byOrganization.entries()].map(([organizationId, organization]) => ({
            organizationId,
            name: organization.name,
            versions: organization.versions,
          })),
        };
      },
    );
  }
}
