import { Injectable } from '@nestjs/common';
import { ENTITY_STATUS, type EntityStatus } from '@api/modules/core/entity/models/reporting-entity.model';
import type {
  OrganizationEntitiesRead,
  OrganizationEntitiesStore,
} from '@api/modules/platform/admin/interfaces/organization-entities-store.interface';
import type { OrganizationEntity } from '@api/modules/platform/admin/models/organization-entity.model';
import { ACQUISITION_PURPOSE } from '@api/modules/platform/support-access/models/support-access-log.model';
import { AdminReadOnly } from '../admin-readonly';
import { collated } from '../collation';

interface EntityDbRow {
  id: string;
  name: string;
  idno: string | null;
  status: EntityStatus;
}

/**
 * A-02's record's entities (task 175), read through `esg_admin_ro` — which holds `SELECT` on `core.reporting_entity`
 * already, for the register's count — **one acquisition, logged before it runs** (`admin-readonly.ts`), naming the
 * organization read, under the register's purpose: the record is the register's. Master data only: the name, the
 * IDNO and the status, never a site, a boundary or anything a report holds.
 */
const ENTITIES = `
  SELECT id, name, idno, status
    FROM core.reporting_entity
   WHERE organization_id = $1
   ORDER BY (status = '${ENTITY_STATUS.ACTIVE}') DESC, ${collated('name')}, id`;

@Injectable()
export class OrganizationEntitiesStoreRepository implements OrganizationEntitiesStore {
  constructor(private readonly adminReadOnly: AdminReadOnly) {}

  entities(read: OrganizationEntitiesRead): Promise<readonly OrganizationEntity[] | null> {
    return this.adminReadOnly.acquire(
      {
        requesterId: read.requesterId,
        purpose: ACQUISITION_PURPOSE.ORGANIZATION_REGISTER,
        organizationId: read.organizationId,
      },
      async (runner) => {
        const found = (await runner.query(`SELECT 1 FROM core.organization WHERE id = $1`, [
          read.organizationId,
        ])) as unknown[];
        if (found.length === 0) return null;
        const rows = (await runner.query(ENTITIES, [read.organizationId])) as EntityDbRow[];
        return rows.map(
          (row): OrganizationEntity => ({ id: row.id, name: row.name, idno: row.idno, status: row.status }),
        );
      },
    );
  }
}
