import { Injectable } from '@nestjs/common';
import type { QueryRunner } from 'typeorm';
import type { SupportAccessRequestCounts } from '@api/modules/platform/admin/interfaces/support-access-request-counts.interface';
import {
  ACQUISITION_PURPOSE,
  SUPPORT_ACCESS_ENTRY_KIND,
} from '@api/modules/platform/support-access/models/support-access-log.model';
import { AdminReadOnly } from '../admin-readonly';

/**
 * A-08's support-access column, as one grouped count over the log (task 67.9) — through `esg_admin_ro`, logged
 * first under the support-access-log purpose, because a request row is visible to `esg_app` only with its own
 * organization bound and this counts them all. **Requests only**: whatever became of a request, asking is
 * what the column counts.
 */
@Injectable()
export class SupportAccessRequestCountsRepository implements SupportAccessRequestCounts {
  constructor(private readonly adminReadOnly: AdminReadOnly) {}

  since(read: { readonly requesterId: string; readonly since: Date }): Promise<ReadonlyMap<string, number>> {
    return this.adminReadOnly.acquire(
      { requesterId: read.requesterId, purpose: ACQUISITION_PURPOSE.SUPPORT_ACCESS_LOG, organizationId: null },
      async (runner: QueryRunner) => {
        const rows = (await runner.query(
          `SELECT requester_id, count(*)::int AS requests
             FROM audit.support_access_log
            WHERE entry_kind = $1 AND occurred_at >= $2
            GROUP BY requester_id`,
          [SUPPORT_ACCESS_ENTRY_KIND.REQUEST, read.since],
        )) as { requester_id: string; requests: number }[];
        return new Map(rows.map((row) => [row.requester_id, row.requests]));
      },
    );
  }
}
