import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { ConsoleRoleStore } from '@api/modules/platform/admin/interfaces/console-role-store.interface';
import {
  isConsoleRole,
  orderedConsoleRoles,
  type ConsoleRole,
} from '@api/modules/platform/admin/models/console-role.model';
import { CORE_DATA_SOURCE } from '../data-source';

/**
 * `identity.admin_console_role` read for one operator (task 67.13), as `esg_app` on its own connection — the realm
 * binds no tenant. **A role this release does not know reads as not held**, `isAdminRole`'s rule: the `CHECK` makes it
 * impossible today, and the day it is not, defaulting it would hand out powers nobody granted.
 */
@Injectable()
export class ConsoleRoleStoreRepository implements ConsoleRoleStore {
  constructor(@InjectDataSource(CORE_DATA_SOURCE) private readonly dataSource: DataSource) {}

  async rolesOf(read: { readonly accountId: string }): Promise<readonly ConsoleRole[]> {
    const rows = await this.dataSource.query<{ role: string }[]>(
      `SELECT role FROM identity.admin_console_role WHERE account_id = $1`,
      [read.accountId],
    );
    return orderedConsoleRoles(rows.map((row) => row.role).filter(isConsoleRole));
  }
}
