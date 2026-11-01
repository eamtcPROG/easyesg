import type { Clock } from '@api/contracts/clock.port';
import { SUPPORT_ACCESS_REQUEST_WINDOW_MS, adminRosterRowsOf } from '../domain/admin-standing';
import type { AdminAccountStore } from '../interfaces/admin-account-store.interface';
import type { SupportAccessRequestCounts } from '../interfaces/support-access-request-counts.interface';
import type { AdminRosterRow } from '../models/admin-roster.model';

export interface ListAdminRosterQuery {
  /** The operator reading — the support-access count's acquisition names them. */
  readonly requesterId: string;
}

/**
 * UC-87's read — A-08's account table (task 67.4): every operator account, removed ones kept for
 * attribution, and every pending invitation, each with the one-word state `adminRosterRowsOf` reads
 * from its facts, and since task 67.9 how many support-access requests each account raised in 30 days.
 *
 * **The roster is read as `esg_app`; the count through `esg_admin_ro`.** The realm's tables carry no row
 * security and the application already holds them, so the roster acquires nothing — but the requests it
 * counts span every organization, so that half is a logged acquisition, as A-08's log read is.
 *
 * **Unpaginated, deliberately**: an operator roster is tens of rows, not the register's two thousand,
 * and a pager on it would be a control nobody ever reaches the second page of.
 */
export class ListAdminRoster {
  constructor(
    private readonly store: AdminAccountStore,
    private readonly requests: SupportAccessRequestCounts,
    private readonly now: Clock,
  ) {}

  async execute(query: ListAdminRosterQuery): Promise<AdminRosterRow[]> {
    const now = this.now();
    const roster = await this.store.run((tx) => tx.readRoster());
    const supportAccessRequests = await this.requests.since({
      requesterId: query.requesterId,
      since: new Date(now.getTime() - SUPPORT_ACCESS_REQUEST_WINDOW_MS),
    });
    return adminRosterRowsOf({ roster, now, supportAccessRequests });
  }
}
