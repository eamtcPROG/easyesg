import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import type { SupportAccessLedger } from '@api/modules/platform/support-access/interfaces/support-access-ledger.interface';
import { SUPPORT_ACCESS_ENTRY_KIND } from '@api/modules/platform/support-access/models/support-access-log.model';
import {
  SUPPORT_ACCESS_ACTOR_REALM,
  type SupportAccessHistory,
  type SupportAccessRequestRecord,
} from '@api/modules/platform/support-access/models/support-access-request.model';
import { CORE_DATA_SOURCE } from '../data-source';
import { boundReadOnly } from './bound-read-only';
import { historyWhere, insertLogRow, requestHistory, type Run } from './support-access.queries';

/**
 * The platform's side of support access (task 67.9), for an admin-realm request that binds no tenant.
 *
 * **It reads bound to the organization named, read-only, as `esg_app`** — never through `esg_admin_ro` — so
 * what an operator is told about one organization's requests is exactly what that organization's policies
 * show, and asking about a request costs no `BYPASSRLS` acquisition. **It writes with nothing bound**, on a
 * pooled connection, which is the only shape the log's platform insert policy admits: a request or an end,
 * never a grant or a decline.
 */
@Injectable()
export class SupportAccessLedgerRepository implements SupportAccessLedger {
  constructor(@InjectDataSource(CORE_DATA_SOURCE) private readonly core: DataSource) {}

  private readonly unbound: Run = (sql, parameters) => this.core.query(sql, parameters as unknown[]);

  operatorHistory(query: {
    readonly organizationId: string;
    readonly requesterId: string;
    readonly since: Date;
  }): Promise<SupportAccessHistory | null> {
    return boundReadOnly(this.core, query.organizationId, async (run) => {
      // Under the organization's own select policy a stranger's id finds nothing, and an unbound one could
      // not — so existence is asked the same way a member's read would ask it.
      const [found] = (await run(`SELECT EXISTS (SELECT 1 FROM core.organization WHERE id = $1) AS found`, [
        query.organizationId,
      ])) as { found: boolean }[];
      if (!found.found) return null;
      return historyWhere(run, 'l.requester_id = $2 AND l.occurred_at >= $3', [query.requesterId, query.since]);
    });
  }

  request(query: {
    readonly organizationId: string;
    readonly requestId: string;
  }): Promise<SupportAccessHistory | null> {
    return boundReadOnly(this.core, query.organizationId, (run) => requestHistory(run, query.requestId));
  }

  async recordRequest(command: {
    readonly organizationId: string;
    readonly requesterId: string;
    readonly ticketReference: string;
    readonly reason: string;
    readonly at: Date;
  }): Promise<{ readonly id: string }> {
    // The id is minted here rather than returned by the insert: `esg_app` may read back only rows the
    // bound organization's policy shows it, and this connection binds none.
    const id = randomUUID();
    await insertLogRow(this.unbound, {
      id,
      at: command.at,
      kind: SUPPORT_ACCESS_ENTRY_KIND.REQUEST,
      requestId: null,
      requesterId: command.requesterId,
      organizationId: command.organizationId,
      actorId: null,
      actorRealm: null,
      ticketReference: command.ticketReference,
      reason: command.reason,
      purpose: null,
      subject: null,
    });
    return { id };
  }

  async recordEnd(command: {
    readonly request: SupportAccessRequestRecord;
    readonly actorId: string;
    readonly at: Date;
  }): Promise<void> {
    await insertLogRow(this.unbound, {
      id: randomUUID(),
      at: command.at,
      kind: SUPPORT_ACCESS_ENTRY_KIND.END,
      requestId: command.request.id,
      requesterId: command.request.requesterId,
      organizationId: command.request.organizationId,
      actorId: command.actorId,
      actorRealm: SUPPORT_ACCESS_ACTOR_REALM.PLATFORM,
      ticketReference: null,
      reason: null,
      purpose: null,
      subject: null,
    });
  }
}
