import { Injectable } from '@nestjs/common';
import type { ReportingEntityStore } from '@api/modules/core/entity/interfaces/reporting-entity-store.interface';
import {
  ENTITY_STATUS,
  type ConsolidationBasis,
  type ConsolidationMember,
  type EntityStatus,
  type NewConsolidationMember,
  type NewReportingEntity,
  type NewSite,
  type ReportingEntity,
  type ReportingEntityPatch,
  type Site,
} from '@api/modules/core/entity/models/reporting-entity.model';
import { TenantRepository } from '../tenant-repository';

interface EntityRow {
  id: string;
  name: string;
  legal_form: string | null;
  nace_codes: string[];
  status: EntityStatus;
  consolidation_basis: ConsolidationBasis | null;
  archived_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface SiteRow {
  id: string;
  reporting_entity_id: string;
  name: string;
  address_line1: string | null;
  locality: string | null;
  postal_code: string | null;
  country_code: string | null;
  latitude: string | null;
  longitude: string | null;
}

const ENTITY_COLUMNS = `id, name, legal_form, nace_codes, status, consolidation_basis,
        archived_at, created_at, updated_at`;
const MEMBER_COLUMNS = `id, reporting_entity_id, name, idno, lei, country_code`;
const SITE_COLUMNS = `id, reporting_entity_id, name, address_line1, locality, postal_code,
        country_code, latitude, longitude`;

/** The columns a patch may name. `sites` is absent: it is a collection, synced separately below. */
const PATCHABLE = {
  name: 'name',
  legalForm: 'legal_form',
  naceCodes: 'nace_codes',
  consolidationBasis: 'consolidation_basis',
} as const satisfies Record<
  keyof Omit<ReportingEntityPatch, 'sites' | 'consolidationMembers'>,
  string
>;

const toSite = (row: SiteRow): Site => ({
  id: row.id,
  name: row.name,
  addressLine1: row.address_line1,
  locality: row.locality,
  postalCode: row.postal_code,
  countryCode: row.country_code,
  // `numeric` crosses the driver boundary as a string and stays one (AD-14 constraint 4): parsing
  // it into a double here would reintroduce the representation NFR-58 forbids the column to use.
  latitude: row.latitude,
  longitude: row.longitude,
});

interface MemberRow {
  id: string;
  reporting_entity_id: string;
  name: string;
  idno: string | null;
  lei: string | null;
  country_code: string | null;
}

const toMember = (row: MemberRow): ConsolidationMember => ({
  id: row.id,
  name: row.name,
  idno: row.idno,
  lei: row.lei,
  countryCode: row.country_code,
});

const toEntity = (
  row: EntityRow,
  sites: Site[],
  consolidationMembers: ConsolidationMember[],
): ReportingEntity => ({
  id: row.id,
  name: row.name,
  legalForm: row.legal_form,
  naceCodes: row.nace_codes,
  status: row.status,
  consolidationBasis: row.consolidation_basis,
  consolidationMembers,
  archivedAt: row.archived_at,
  sites,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/**
 * The `ReportingEntityStore` adapter (UC-52, UC-53, UC-55).
 *
 * **No statement names an organization.** RLS scopes every one to `app.current_org`, and the
 * composite foreign keys tie each site's tenant to its entity's, so a site cannot be reached from
 * the wrong tenant even if its own column were wrong. An entity id in a `WHERE` is a different
 * thing from a tenant id: it selects a row *within* the bound tenant, and another tenant's id
 * simply matches nothing.
 *
 * **Entities and their sites are read as two statements and stitched**, rather than one query with
 * a JSON aggregate. Two indexed reads over a collection bounded by an organization's own entities
 * cost less than the aggregate costs to read, and the stitch is four lines that a reviewer can
 * check against the model — where a `jsonb_agg` shape has to be trusted.
 */
@Injectable()
export class ReportingEntityStoreRepository
  extends TenantRepository<never>
  implements ReportingEntityStore
{
  protected readonly entity = 'core.reporting_entity' as never;

  /** §7.6's expression, so the two inserts supply exactly what the policies check. */
  private readonly boundOrganization = `NULLIF(current_setting('app.current_org', true), '')::uuid`;

  private async sitesFor(entityIds: string[]): Promise<Map<string, Site[]>> {
    const grouped = new Map<string, Site[]>(entityIds.map((id) => [id, []]));
    if (entityIds.length === 0) return grouped;

    const rows = await this.manager.query<SiteRow[]>(
      `SELECT ${SITE_COLUMNS} FROM core.site
        WHERE reporting_entity_id = ANY($1)
        ORDER BY name, id`,
      [entityIds],
    );
    for (const row of rows) grouped.get(row.reporting_entity_id)?.push(toSite(row));
    return grouped;
  }

  private async membersFor(entityIds: string[]): Promise<Map<string, ConsolidationMember[]>> {
    const grouped = new Map<string, ConsolidationMember[]>(entityIds.map((id) => [id, []]));
    if (entityIds.length === 0) return grouped;

    const rows = await this.manager.query<MemberRow[]>(
      `SELECT ${MEMBER_COLUMNS} FROM core.consolidation_member
        WHERE reporting_entity_id = ANY($1)
        ORDER BY name, id`,
      [entityIds],
    );
    for (const row of rows) grouped.get(row.reporting_entity_id)?.push(toMember(row));
    return grouped;
  }

  async listEntities(): Promise<ReportingEntity[]> {
    const rows = await this.manager.query<EntityRow[]>(
      `SELECT ${ENTITY_COLUMNS} FROM core.reporting_entity ORDER BY name, id`,
    );
    const ids = rows.map((row) => row.id);
    const [sites, members] = await Promise.all([this.sitesFor(ids), this.membersFor(ids)]);
    return rows.map((row) => toEntity(row, sites.get(row.id) ?? [], members.get(row.id) ?? []));
  }

  async findEntity(entityId: string): Promise<ReportingEntity | null> {
    const rows = await this.manager.query<EntityRow[]>(
      `SELECT ${ENTITY_COLUMNS} FROM core.reporting_entity WHERE id = $1`,
      [entityId],
    );
    if (rows.length === 0) return null;
    const [sites, members] = await Promise.all([
      this.sitesFor([entityId]),
      this.membersFor([entityId]),
    ]);
    return toEntity(rows[0], sites.get(entityId) ?? [], members.get(entityId) ?? []);
  }

  async create(input: { entity: NewReportingEntity; at: Date }): Promise<ReportingEntity> {
    // `RETURNING` is safe here, unlike on the tenant root: this table's SELECT policy is the
    // ordinary `organization_id = app.current_org`, and the insert supplies that very value — so
    // the returned row passes the policy that task 29.1's founding insert could not.
    const rows = await this.manager.query<EntityRow[]>(
      `INSERT INTO core.reporting_entity (organization_id, name, legal_form, nace_codes, created_at, updated_at)
            VALUES (${this.boundOrganization}, $1, $2, $3, $4, $4)
         RETURNING ${ENTITY_COLUMNS}`,
      [input.entity.name, input.entity.legalForm, input.entity.naceCodes, input.at],
    );
    const created = rows[0];
    await this.syncSites(created.id, input.entity.sites, input.at);
    const sites = await this.sitesFor([created.id]);
    return toEntity(created, sites.get(created.id) ?? [], []);
  }

  async update(input: {
    entityId: string;
    patch: ReportingEntityPatch;
    at: Date;
  }): Promise<ReportingEntity | null> {
    const assignments: string[] = [];
    const parameters: unknown[] = [input.entityId];

    for (const [field, column] of Object.entries(PATCHABLE)) {
      const value = input.patch[field as keyof typeof PATCHABLE];
      // `undefined` is "absent from the patch"; `null` clears. `naceCodes` is never null — an
      // empty array is how a caller says "no classification", and the column is NOT NULL.
      if (value === undefined) continue;
      parameters.push(value);
      assignments.push(`${column} = $${parameters.length}`);
    }

    parameters.push(input.at);
    assignments.push(`updated_at = $${parameters.length}`);

    const result = await this.manager.query<[EntityRow[], number]>(
      `UPDATE core.reporting_entity SET ${assignments.join(', ')} WHERE id = $1
         RETURNING ${ENTITY_COLUMNS}`,
      parameters,
    );
    const [rows] = result;
    if (rows.length === 0) return null;

    if (input.patch.sites !== undefined) {
      await this.syncSites(input.entityId, input.patch.sites, input.at);
    }
    if (input.patch.consolidationMembers !== undefined) {
      await this.syncMembers(input.entityId, input.patch.consolidationMembers, input.at);
    }
    const [sites, members] = await Promise.all([
      this.sitesFor([input.entityId]),
      this.membersFor([input.entityId]),
    ]);
    return toEntity(rows[0], sites.get(input.entityId) ?? [], members.get(input.entityId) ?? []);
  }

  async archive(input: { entityId: string; at: Date }): Promise<boolean> {
    const result = await this.manager.query<[unknown[], number]>(
      // `status = $4` rather than an interpolated literal: a vocabulary member is a *value*, and
      // the one place this codebase interpolates one into SQL is a migration, where the literal is
      // frozen history (CLAUDE.md). Here it is a bind parameter like any other.
      //
      // The `status` predicate makes this a conditional update, so archiving an already-archived
      // entity returns no row — the use case has already refused it, and this is the layer that
      // makes the refusal true under a concurrent second request rather than merely likely.
      `UPDATE core.reporting_entity
          SET status = $2, archived_at = $3, updated_at = $3
        WHERE id = $1 AND status = $4
         RETURNING id`,
      [input.entityId, ENTITY_STATUS.ARCHIVED, input.at, ENTITY_STATUS.ACTIVE],
    );
    const [rows] = result;
    return rows.length > 0;
  }

  /**
   * The whole-collection sync S-13's explicit save implies.
   *
   * **Updates rather than replaces where a site persists**, which is what keeps FR-54's trail
   * useful: a corrected postcode records one changed field, where a delete-and-reinsert would
   * record a site vanishing and an unrelated one appearing. A submitted `id` that is not this
   * entity's simply updates nothing — the `WHERE` pins the parent and RLS pins the tenant.
   */
  /**
   * The boundary's members, synced exactly as the sites are (UC-54).
   *
   * **Not conditional on the basis.** Switching to `individual` leaves the list standing; B1 reads
   * the basis first and this only when it says `consolidated`, so an inert list costs nothing and a
   * deleted one cannot be got back.
   */
  private async syncMembers(
    entityId: string,
    members: readonly NewConsolidationMember[],
    at: Date,
  ): Promise<void> {
    const keep = members.map((m) => m.id).filter((id): id is string => id !== undefined);
    await this.manager.query(
      `DELETE FROM core.consolidation_member
        WHERE reporting_entity_id = $1 AND NOT (id = ANY($2))`,
      [entityId, keep],
    );

    for (const member of members) {
      const values = [member.name, member.idno, member.lei, member.countryCode];
      if (member.id === undefined) {
        await this.manager.query(
          `INSERT INTO core.consolidation_member
             (organization_id, reporting_entity_id, name, idno, lei, country_code, created_at, updated_at)
           VALUES (${this.boundOrganization}, $1, $2, $3, $4, $5, $6, $6)`,
          [entityId, ...values, at],
        );
      } else {
        await this.manager.query(
          `UPDATE core.consolidation_member
              SET name = $3, idno = $4, lei = $5, country_code = $6, updated_at = $7
            WHERE id = $1 AND reporting_entity_id = $2`,
          [member.id, entityId, ...values, at],
        );
      }
    }
  }

  private async syncSites(entityId: string, sites: readonly NewSite[], at: Date): Promise<void> {
    const keep = sites.map((site) => site.id).filter((id): id is string => id !== undefined);

    await this.manager.query(
      `DELETE FROM core.site
        WHERE reporting_entity_id = $1 AND NOT (id = ANY($2))`,
      [entityId, keep],
    );

    for (const site of sites) {
      const values = [
        site.name,
        site.addressLine1,
        site.locality,
        site.postalCode,
        site.countryCode,
        site.latitude,
        site.longitude,
      ];
      if (site.id === undefined) {
        await this.manager.query(
          `INSERT INTO core.site (organization_id, reporting_entity_id, name, address_line1,
                                  locality, postal_code, country_code, latitude, longitude,
                                  created_at, updated_at)
                VALUES (${this.boundOrganization}, $1, $2, $3, $4, $5, $6, $7, $8, $9, $9)`,
          [entityId, ...values, at],
        );
      } else {
        await this.manager.query(
          `UPDATE core.site
              SET name = $3, address_line1 = $4, locality = $5, postal_code = $6,
                  country_code = $7, latitude = $8, longitude = $9, updated_at = $10
            WHERE id = $1 AND reporting_entity_id = $2`,
          [site.id, entityId, ...values, at],
        );
      }
    }
  }
}
