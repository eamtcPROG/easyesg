import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import type { FactorSetUsers } from '@api/modules/core/calculator/interfaces/factor-set-users.interface';
import type { FactorSetPin } from '@api/modules/core/calculator/models/factor-set.model';
import { CORE_DATA_SOURCE } from '../data-source';

/**
 * `FACTOR_SET_USERS` (task 37.3) — the organizations with a run on a factor-set revision, read across tenants.
 *
 * **Not a `TenantRepository`, and on purpose** (one of the tenancy exceptions `apps/api/CLAUDE.md` lists): it runs on
 * a pooled connection as `esg_worker` with **no organization bound**, which is the one state in which
 * `calc_run_worker_directory_select` lets the worker see every run (`architecture.md` §12.5.6's task-37.3/37.4 row (4)).
 * Inside a request or a `TENANT_WORK` unit the binding would scope it to one organization and the answer would be
 * silently partial — so it takes the data source, never the context's runner. It answers ids and nothing else: what
 * an organization's runs say is read bound to it.
 */
@Injectable()
export class FactorSetUsersRepository implements FactorSetUsers {
  constructor(@InjectDataSource(CORE_DATA_SOURCE) private readonly dataSource: DataSource) {}

  async organizationsUsing(pin: FactorSetPin): Promise<readonly string[]> {
    const rows = await this.dataSource.query<{ organization_id: string }[]>(
      `SELECT DISTINCT organization_id FROM core.calc_run
        WHERE factor_set_country = $1 AND factor_set_revision = $2
        ORDER BY organization_id`,
      [pin.country, pin.revision],
    );
    return rows.map((row) => row.organization_id);
  }
}
