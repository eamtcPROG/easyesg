import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { OrganizationSupportAccessStore } from '@api/modules/platform/support-access/interfaces/organization-support-access-store.interface';
import {
  SUPPORT_ACCESS_ACTOR_REALM,
  type SupportAccessDecisionKind,
  type SupportAccessHistory,
  type SupportAccessRequestRecord,
} from '@api/modules/platform/support-access/models/support-access-request.model';
import { TenantRepository } from '../tenant-repository';
import { historyWhere, insertLogRow, requestHistory, type Run } from './support-access.queries';

/**
 * The organization's side of support access (task 67.9), on the tenant request's own transaction.
 *
 * **The log's policies do the scoping**: the select policy shows this connection the bound organization's
 * requests and answers and nothing else — never a platform read's row — and the insert policy admits a
 * grant, decline or end only for the bound organization and only with the bound member as its actor. So a
 * request id from another organization reads as no request, and no row this store writes can speak for
 * anybody but the member making the request.
 */
@Injectable()
export class OrganizationSupportAccessStoreRepository
  extends TenantRepository<never>
  implements OrganizationSupportAccessStore
{
  protected readonly entity = 'audit.support_access_log' as never;

  private readonly run: Run = (sql, parameters) => this.manager.query(sql, parameters as unknown[]);

  history(query: { readonly since: Date }): Promise<SupportAccessHistory> {
    return historyWhere(this.run, 'l.occurred_at >= $2', [query.since]);
  }

  async lock(query: { readonly requestId: string }): Promise<SupportAccessHistory | null> {
    // Transaction-scoped, released at commit or rollback: the second of two answers waits here, then reads
    // the first one's row — task 142's per-organization seat lock, keyed by the request instead.
    await this.run(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [
      `support-access:${query.requestId}`,
    ]);
    return requestHistory(this.run, query.requestId);
  }

  async record(decision: {
    readonly request: SupportAccessRequestRecord;
    readonly kind: SupportAccessDecisionKind;
    readonly actorId: string;
    readonly at: Date;
  }): Promise<void> {
    await insertLogRow(this.run, {
      id: randomUUID(),
      at: decision.at,
      kind: decision.kind,
      requestId: decision.request.id,
      requesterId: decision.request.requesterId,
      organizationId: decision.request.organizationId,
      actorId: decision.actorId,
      actorRealm: SUPPORT_ACCESS_ACTOR_REALM.ORGANIZATION,
      ticketReference: null,
      reason: null,
      purpose: null,
      subject: null,
    });
  }
}
