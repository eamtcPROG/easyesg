import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import type { CookieChoiceStore } from '@api/modules/platform/legal/interfaces/cookie-choice-store.interface';
import type { RecordedCookieChoice } from '@api/modules/platform/legal/models/cookie-choice.model';
import { CORE_DATA_SOURCE } from '../data-source';

/**
 * `COOKIE_CHOICE_STORE` (task 223; `1793404800000-cookie-choice.ts`). **On the `DataSource`**, not a request's runner:
 * the table has no row security and names no organization, and a visitor's request has no runner of its own to join.
 * As `esg_app` on the request tier — `INSERT` and `SELECT` — and as `esg_worker` on the worker — `SELECT` and `DELETE`;
 * each process reaches only its half.
 */
@Injectable()
export class CookieChoiceStoreRepository implements CookieChoiceStore {
  constructor(@InjectDataSource(CORE_DATA_SOURCE) private readonly dataSource: DataSource) {}

  async record(input: { readonly policyVersion: string; readonly accountId: string | null }): Promise<RecordedCookieChoice> {
    const [row] = await this.dataSource.query<{ id: string; policy_version: string; chosen_at: Date }[]>(
      `INSERT INTO identity.cookie_choice (policy_version, account_id) VALUES ($1, $2)
       RETURNING id, policy_version, chosen_at`,
      [input.policyVersion, input.accountId],
    );
    return { id: row.id, policyVersion: row.policy_version, chosenAt: row.chosen_at };
  }

  async purgeOlderThan(input: { readonly asOf: Date; readonly months: number }): Promise<number> {
    // Counted in a CTE so the answer is a row whatever TypeORM makes of a bare `DELETE`'s result (`returned-rows.ts`).
    const [{ deleted }] = await this.dataSource.query<{ deleted: number }[]>(
      `WITH purged AS (
         DELETE FROM identity.cookie_choice
          WHERE chosen_at < $1::timestamptz - make_interval(months => $2::int)
         RETURNING 1
       )
       SELECT count(*)::int AS deleted FROM purged`,
      [input.asOf, input.months],
    );
    return deleted;
  }
}
