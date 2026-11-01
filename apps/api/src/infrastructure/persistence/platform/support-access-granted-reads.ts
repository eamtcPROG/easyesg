import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import type {
  GrantedReadSession,
  GrantedReads,
} from '@api/modules/platform/support-access/interfaces/granted-reads.interface';
import { SUPPORT_ACCESS_ENTRY_KIND } from '@api/modules/platform/support-access/models/support-access-log.model';
import { CORE_DATA_SOURCE } from '../data-source';
import { requestContext } from '../request-context';
import { insertLogRow, requestHistory, type Run } from './support-access.queries';

/**
 * The window a live support-access grant opens (task 67.9; FR-77 … FR-79, D-5), for an admin-realm request.
 *
 * **It lends the request a tenant binding it would otherwise never have.** An admin-realm request carries no
 * member, so `TenantTransactionGuard` opens nothing for it; this opens a `READ ONLY` transaction as `esg_app`
 * bound to the granted organization and **places it on the request context** for the length of the work, so
 * the organization's own report read models — which find their transaction there — run unchanged, under the
 * same policies a member's read runs under. `esg_admin_ro` is not the path, by the owner's decision.
 *
 * **The access row commits first, on a connection of its own, before the read runs**, and a failed write
 * refuses the read — `admin-readonly.ts`'s stance, because *what was accessed* (FR-79) is the condition of
 * the access. **The binding is taken back in `finally`**, so neither the response pipeline's commit nor the
 * exception filter's rollback ever finds this runner, and nothing after the work runs bound.
 */
@Injectable()
export class SupportAccessGrantedReads implements GrantedReads {
  constructor(@InjectDataSource(CORE_DATA_SOURCE) private readonly core: DataSource) {}

  private readonly unbound: Run = (sql, parameters) => this.core.query(sql, parameters as unknown[]);

  async within<T>(
    scope: { readonly organizationId: string },
    work: (session: GrantedReadSession) => Promise<T>,
  ): Promise<T> {
    const ctx = requestContext();
    if (!ctx) throw new Error('A read under a support-access grant runs inside a request.');
    if (ctx.queryRunner !== undefined || ctx.organizationId !== undefined) {
      throw new Error('A read under a support-access grant never runs inside another tenant binding.');
    }

    const runner = this.core.createQueryRunner();
    await runner.connect();
    try {
      await runner.startTransaction();
      await runner.query('SET TRANSACTION READ ONLY');
      await runner.query('SELECT set_config($1, $2, true)', ['app.current_org', scope.organizationId]);
      ctx.queryRunner = runner;
      ctx.organizationId = scope.organizationId;

      const bound: Run = (sql, parameters) => runner.query(sql, parameters as unknown[]);
      const result = await work({
        request: ({ requestId }) => requestHistory(bound, requestId),
        recordAccess: (access) =>
          insertLogRow(this.unbound, {
            id: randomUUID(),
            at: access.at,
            kind: SUPPORT_ACCESS_ENTRY_KIND.ACCESS,
            requestId: access.request.id,
            requesterId: access.request.requesterId,
            organizationId: access.request.organizationId,
            actorId: null,
            actorRealm: null,
            ticketReference: null,
            reason: null,
            purpose: access.purpose,
            subject: access.subject,
          }),
      });
      await runner.commitTransaction();
      return result;
    } catch (error) {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      throw error;
    } finally {
      ctx.queryRunner = undefined;
      ctx.organizationId = undefined;
      await runner.release();
    }
  }
}
