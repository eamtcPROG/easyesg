import { Injectable } from '@nestjs/common';
import type { EntityIdentifiers, EntityIdentifiersStore } from '@api/modules/core/export/interfaces/entity-identifiers.interface';
import { TenantRepository } from '../tenant-repository';

/**
 * `EntityIdentifiersStore` over `core.reporting_entity`, by the report's period (task 46.1) — on the export job's tenant
 * unit of work, where `esg_worker`'s table-level `SELECT` reaches the entity as row security admits it.
 */
@Injectable()
export class EntityIdentifiersRepository extends TenantRepository<never> implements EntityIdentifiersStore {
  protected readonly entity = 'core.reporting_entity' as never;

  async identifiersOf(query: { readonly reportId: string }): Promise<EntityIdentifiers | null> {
    const rows = await this.manager.query<EntityIdentifiers[]>(
      `SELECT e.lei, e.idno
         FROM core.report r
         JOIN core.reporting_period p ON p.id = r.reporting_period_id
         JOIN core.reporting_entity e ON e.id = p.reporting_entity_id
        WHERE r.id = $1`,
      [query.reportId],
    );
    return rows[0] ?? null;
  }
}
