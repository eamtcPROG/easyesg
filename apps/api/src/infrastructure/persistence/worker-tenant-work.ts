import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { SOURCE_LOCALE } from '@easyesg/i18n';
import type { TenantWork } from '@api/contracts/tenant-work.port';
import { CORE_DATA_SOURCE } from './data-source';
import { runInRequestContext } from './request-context';

/**
 * `TENANT_WORK` on the worker (task 37.3): a transaction as `esg_worker`, bound to one organization, holding a request
 * context whose runner is that transaction — so `TenantRepository` and the notification port's outbox writes find it
 * exactly as they find a request's.
 *
 * **`app.current_org` alone is bound**, `NotificationStoreRepository`'s worker binding: nobody is acting, and
 * `app.current_user` unset is what a policy reading it expects of a system write. The context's locale is the source
 * locale, which nothing here words in — a notice is worded per recipient at delivery (FR-169).
 *
 * **Commit on the work's success and roll back on its failure**, then release either way — the request pipeline's
 * three outcomes in one place, since no guard, interceptor or filter spans a job.
 */
@Injectable()
export class WorkerTenantWork implements TenantWork {
  constructor(@InjectDataSource(CORE_DATA_SOURCE) private readonly dataSource: DataSource) {}

  async inOrganization<T>(scope: { readonly organizationId: string }, work: () => Promise<T>): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      await queryRunner.startTransaction();
      await queryRunner.query('SELECT set_config($1, $2, true)', ['app.current_org', scope.organizationId]);
      const result = await runInRequestContext(
        { correlationId: randomUUID(), locale: SOURCE_LOCALE, organizationId: scope.organizationId, queryRunner },
        work,
      );
      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
