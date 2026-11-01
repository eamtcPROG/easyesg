import type { ReportingEntityStore } from '../interfaces/reporting-entity-store.interface';
import {
  ENTITY_STATUS,
  type NewReportingEntity,
  type ReportingEntity,
  type ReportingEntityPatch,
} from '../models/reporting-entity.model';

/**
 * An in-memory `ReportingEntityStore` for the use-case spec — no database, no container.
 *
 * **It models one organization, because RLS does**: the real store takes no organization id
 * anywhere. Cross-tenant behaviour is asserted where it is enforced, in `tenant-isolation.e2e-spec.ts`.
 */
export const anEntity = (overrides: Partial<ReportingEntity> = {}): ReportingEntity => ({
  id: '00000000-0000-0000-0000-0000000000b1',
  name: 'Brutăria Lina',
  legalForm: 'srl',
  idno: null,
  lei: null,
  registeredAddressLine1: null,
  registeredAddressLine2: null,
  registeredLocality: null,
  registeredPostalCode: null,
  reportContactName: null,
  reportContactEmail: null,
  naceCodes: ['10.71'],
  status: ENTITY_STATUS.ACTIVE,
  consolidationBasis: null,
  consolidationMembers: [],
  archivedAt: null,
  sites: [],
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  updatedAt: new Date('2026-08-01T00:00:00.000Z'),
  ...overrides,
});

export class FakeReportingEntityStore implements ReportingEntityStore {
  constructor(private rows: ReportingEntity[] = [anEntity()]) {}

  get all(): readonly ReportingEntity[] {
    return this.rows;
  }

  listEntities(): Promise<ReportingEntity[]> {
    return Promise.resolve([...this.rows]);
  }

  findEntity(entityId: string): Promise<ReportingEntity | null> {
    return Promise.resolve(this.rows.find((row) => row.id === entityId) ?? null);
  }

  create(input: { entity: NewReportingEntity; at: Date }): Promise<ReportingEntity> {
    const created = anEntity({
      id: `00000000-0000-0000-0000-0000000000${String(this.rows.length + 2).padStart(2, '0')}`,
      name: input.entity.name,
      legalForm: input.entity.legalForm,
      idno: input.entity.idno,
      lei: input.entity.lei,
      registeredAddressLine1: input.entity.registeredAddressLine1,
      registeredAddressLine2: input.entity.registeredAddressLine2,
      registeredLocality: input.entity.registeredLocality,
      registeredPostalCode: input.entity.registeredPostalCode,
      reportContactName: input.entity.reportContactName,
      reportContactEmail: input.entity.reportContactEmail,
      naceCodes: input.entity.naceCodes,
      sites: input.entity.sites.map((site, index) => ({ ...site, id: site.id ?? `site-${index}` })),
      consolidationBasis: input.entity.consolidationBasis,
      consolidationMembers: input.entity.consolidationMembers.map((member, index) => ({
        ...member,
        id: member.id ?? `member-${index}`,
      })),
      createdAt: input.at,
      updatedAt: input.at,
    });
    this.rows.push(created);
    return Promise.resolve(created);
  }

  update(input: {
    entityId: string;
    patch: ReportingEntityPatch;
    at: Date;
  }): Promise<ReportingEntity | null> {
    const index = this.rows.findIndex((row) => row.id === input.entityId);
    if (index === -1) return Promise.resolve(null);
    const { sites, consolidationMembers, ...fields } = input.patch;
    this.rows[index] = {
      ...this.rows[index],
      ...fields,
      ...(sites ? { sites: sites.map((s, i) => ({ ...s, id: s.id ?? `site-${i}` })) } : {}),
      ...(consolidationMembers
        ? {
            consolidationMembers: consolidationMembers.map((m, i) => ({
              ...m,
              id: m.id ?? `member-${i}`,
            })),
          }
        : {}),
      updatedAt: input.at,
    };
    return Promise.resolve(this.rows[index]);
  }

  archive(input: { entityId: string; at: Date }): Promise<boolean> {
    const index = this.rows.findIndex(
      (row) => row.id === input.entityId && row.status === ENTITY_STATUS.ACTIVE,
    );
    if (index === -1) return Promise.resolve(false);
    this.rows[index] = {
      ...this.rows[index],
      status: ENTITY_STATUS.ARCHIVED,
      archivedAt: input.at,
      updatedAt: input.at,
    };
    return Promise.resolve(true);
  }
}
