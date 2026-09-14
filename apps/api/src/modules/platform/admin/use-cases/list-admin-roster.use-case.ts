import type { Clock } from '@api/contracts/clock.port';
import { adminRosterRowsOf } from '../domain/admin-standing';
import type { AdminAccountStore } from '../interfaces/admin-account-store.interface';
import type { AdminRosterRow } from '../models/admin-roster.model';

/**
 * UC-87's read — A-08's account table (task 67.4): every operator account, removed ones kept for
 * attribution, and every pending invitation, each with the one-word state `adminRosterRowsOf` reads
 * from its facts.
 *
 * **Read as `esg_app`, not through `esg_admin_ro`**: the realm's tables carry no row security and
 * the application already holds them, so this is not a cross-organization read and acquires nothing.
 * The log is the half of A-08 that does (`ListSystemAuditLog`).
 *
 * **Unpaginated, deliberately**: an operator roster is tens of rows, not the register's two thousand,
 * and a pager on it would be a control nobody ever reaches the second page of.
 */
export class ListAdminRoster {
  constructor(
    private readonly store: AdminAccountStore,
    private readonly now: Clock,
  ) {}

  async execute(): Promise<AdminRosterRow[]> {
    const roster = await this.store.run((tx) => tx.readRoster());
    return adminRosterRowsOf({ roster, now: this.now() });
  }
}
