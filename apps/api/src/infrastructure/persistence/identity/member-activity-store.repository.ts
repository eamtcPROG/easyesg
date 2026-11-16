import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { MemberActivityStore } from '@api/modules/identity/session/interfaces/member-activity-store.interface';
import { CORE_DATA_SOURCE } from '../data-source';
import { returnedRows } from '../returned-rows';

/**
 * `AuthGuard`'s write of FR-56's *last activity* (28 Sep 2026) — the column the membership migration left for
 * task 28's guard to fill, and which nothing filled until now.
 *
 * **Its own short transaction, not the request's.** `TenantTransactionGuard` opens the request's transaction
 * after `AuthGuard` returns, and holds it for the request's life; a row lock taken in there would make every
 * parallel request of the same member wait for the first to finish. Here the lock lives for one statement, and a
 * second request racing the first re-reads the row after it commits and finds nothing left to write.
 *
 * **One conditional statement**, so a request inside the grain costs an index lookup and writes nothing. The
 * update policy needs the tenant bound (`membership_tenant_update`), and the account is bound beside it so the
 * row's writer is the member themself. The capture trigger ignores `last_active_at` — the migration's reason:
 * presence is not a value anyone changed — so no audit row follows.
 *
 * **And no statement at all while this process recorded the membership inside the grain** (task 244; `architecture.md`
 * §12.5.6's task-244 row (3)). Every authenticated request reaches here, and the conditional statement still costs a
 * pooled connection and four round trips — before the request's own transaction opens — to write nothing. The column
 * only ever moves forward, so what this process last wrote is a floor on what the row holds: within the grain of it,
 * the statement could not write. A request served by another replica, or a first request after a restart, asks the
 * database as before, and only a statement that wrote is remembered.
 */
@Injectable()
export class MemberActivityStoreRepository implements MemberActivityStore {
  /** Each membership's activity as this process last recorded it, in epoch milliseconds. */
  private readonly recordedHere = new Map<string, number>();

  constructor(@InjectDataSource(CORE_DATA_SOURCE) private readonly dataSource: DataSource) {}

  async record(input: Parameters<MemberActivityStore['record']>[0]): Promise<void> {
    const known = this.recordedHere.get(input.membershipId);
    if (known !== undefined && known >= input.unlessSince.getTime()) return;
    const wrote = await this.dataSource.transaction(async (manager) => {
      await manager.query(
        'SELECT set_config($1, $2, true), set_config($3, $4, true)',
        ['app.current_org', input.organizationId, 'app.current_user', input.accountId],
      );
      const updated: unknown = await manager.query(
        `UPDATE identity.membership
            SET last_active_at = $2
          WHERE id = $1
            AND (last_active_at IS NULL OR last_active_at < $3)
         RETURNING id`,
        [input.membershipId, input.at, input.unlessSince],
      );
      return returnedRows<{ id: string }>(updated).length > 0;
    });
    // Remembered only where this statement wrote: a statement that matched nothing proves the row is inside the grain
    // of *some* instant, not of `at`, and remembering `at` would let the row fall up to a grain further behind.
    if (!wrote) return;
    // Bounded by the platform's memberships (≤3,000 users); cleared rather than evicted past that, since forgetting
    // costs one statement per membership and nothing else.
    if (this.recordedHere.size >= RECORDED_HERE_LIMIT) this.recordedHere.clear();
    this.recordedHere.set(input.membershipId, input.at.getTime());
  }
}

/** Comfortably above the scale envelope's memberships — a ceiling against a leak, not a cache size. */
const RECORDED_HERE_LIMIT = 10_000;
