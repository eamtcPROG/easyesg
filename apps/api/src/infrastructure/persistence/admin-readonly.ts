import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource, QueryRunner } from 'typeorm';
import {
  SUPPORT_ACCESS_ENTRY_KIND,
  type AcquisitionPurpose,
} from '@api/modules/platform/support-access/models/support-access-log.model';
import { ADMIN_READONLY_DATA_SOURCE, CORE_DATA_SOURCE } from './data-source';

/** One use of the `BYPASSRLS` role, as FR-79 wants it recorded. */
export interface Acquisition {
  /** The admin account reading — `adminAccountId`, never a tenant actor. */
  readonly requesterId: string;
  readonly purpose: AcquisitionPurpose;
  /** The one organization read, or `null` for a read across organizations. */
  readonly organizationId: string | null;
}

/**
 * `esg_admin_ro`'s home (§7.6; task 67.3) — the one place in the application that holds the role
 * that bypasses RLS, and the reason it may be held at all.
 *
 * **Every acquisition is logged first, and a failed log write refuses the read.** §7.6 grants the
 * role on the condition that every acquisition is logged; a read that happened while its log row did
 * not would be the unlogged cross-tenant read that condition exists to rule out. So the row goes to
 * `audit.support_access_log` on the core connection **before** the read connection is even taken, and
 * the write is awaited and allowed to throw. That is the opposite of `SystemAuditLogRepository`'s
 * never-rethrow, and on purpose: there the log records a refusal that has already happened, here the
 * log is the precondition for the read.
 *
 * **The log row commits even when the read then fails**, because it is written on its own connection
 * outside the read's transaction. An acquisition that was attempted and errored is still an
 * acquisition; a log that rolled back with the read would under-report exactly the reads an
 * operator investigates.
 *
 * **Each read is a `READ ONLY` transaction**, which the role's grants already make true of every
 * table — SELECT and nothing else — and which this states a second time where a reader of the code
 * meets it, at no cost.
 *
 * **Not a `TenantRepository`, and deliberately outside the request's transaction** (the tenancy
 * exceptions `apps/api/CLAUDE.md` lists name this file): nothing here binds `app.current_org`, and a
 * role holding `BYPASSRLS` would ignore the binding anyway.
 */
@Injectable()
export class AdminReadOnly {
  constructor(
    @InjectDataSource(ADMIN_READONLY_DATA_SOURCE) private readonly readOnly: DataSource,
    @InjectDataSource(CORE_DATA_SOURCE) private readonly core: DataSource,
  ) {}

  async acquire<T>(
    acquisition: Acquisition,
    read: (runner: QueryRunner) => Promise<T>,
  ): Promise<T> {
    // `esg_app` holds INSERT here and nothing else, so no RETURNING — the outbox writer's lesson.
    // A pooled core connection binds no organization, which is what the table's platform-only
    // insert policy admits.
    await this.core.query(
      `INSERT INTO audit.support_access_log (entry_kind, requester_id, organization_id, purpose)
       VALUES ($1, $2, $3, $4)`,
      [
        SUPPORT_ACCESS_ENTRY_KIND.ACQUISITION,
        acquisition.requesterId,
        acquisition.organizationId,
        acquisition.purpose,
      ],
    );

    const runner = this.readOnly.createQueryRunner();
    await runner.connect();
    try {
      await runner.startTransaction();
      await runner.query('SET TRANSACTION READ ONLY');
      const result = await read(runner);
      await runner.commitTransaction();
      return result;
    } catch (error) {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }
}
