import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource, QueryRunner } from 'typeorm';
import { toLocale } from '@easyesg/i18n';
import { admitAuthAttempt } from '@api/modules/identity/account/domain/auth-throttle';
import { displayName } from '@api/modules/identity/account/domain/display-name';
import { SUPPORT_REQUEST_RECEIVED } from '@api/modules/platform/support/constants/support.constants';
import type {
  SupportRequestStore,
  SupportRequestSubmission,
} from '@api/modules/platform/support/interfaces/support-request-store.interface';
import {
  SUPPORT_TOPIC,
  isSupportTopic,
  type SupportRequest,
  type SupportSender,
} from '@api/modules/platform/support/models/support-request.model';
import { writeOutboxEvent } from '@api/infrastructure/outbox/outbox-writer';
import { CORE_DATA_SOURCE } from '../data-source';
import { countRecentAuthAttempts, recordAuthAttempt } from '../identity/auth-attempt.queries';
import { setTenantContext } from '../tenant-context';

/**
 * `SUPPORT_REQUEST_STORE` (task 77; `1793577600000-support-request.ts`). **On the `DataSource`**, each call its own
 * connection, for `CookieChoiceStoreRepository`'s reason: the table has no row security and names no organization, and
 * a visitor's request has no runner of its own to join. As `esg_app` on the request tier, which records and reads a
 * reference, and as `esg_worker` on the worker, which reads a request to mail it and purges the old.
 */
@Injectable()
export class SupportRequestStoreRepository implements SupportRequestStore {
  constructor(@InjectDataSource(CORE_DATA_SOURCE) private readonly dataSource: DataSource) {}

  async senderOf(query: {
    readonly accountId: string;
    readonly organizationId: string | null;
  }): Promise<SupportSender | null> {
    return this.inTransaction(async (runner) => {
      // `QueryRunner.query` is not generic, unlike the `DataSource`'s, so its answer is asserted at the call.
      const [account] = (await runner.query(
        `SELECT email, given_name, family_name FROM identity.account WHERE id = $1`,
        [query.accountId],
      )) as { email: string; given_name: string | null; family_name: string | null }[];
      if (account === undefined) return null;

      // The organization's name under its own row security, bound to the organization the guard resolved from the
      // session's membership — the binding every tenant read makes, here for one row.
      let organizationName: string | null = null;
      if (query.organizationId !== null) {
        await setTenantContext(runner, { organizationId: query.organizationId, actorId: query.accountId });
        const [organization] = (await runner.query(`SELECT name FROM core.organization WHERE id = $1`, [
          query.organizationId,
        ])) as { name: string }[];
        organizationName = organization?.name ?? null;
      }

      return {
        accountId: query.accountId,
        name: displayName({ givenName: account.given_name, familyName: account.family_name }, account.email),
        email: account.email,
        organizationName,
      };
    });
  }

  async submit(submission: SupportRequestSubmission): Promise<{ readonly reference: string } | null> {
    return this.inTransaction(async (runner) => {
      const admitted = await admitAuthAttempt(
        {
          countRecentAuthAttempts: (key, since) => countRecentAuthAttempts(runner, key, since),
          recordAuthAttempt: (key, at) => recordAuthAttempt(runner, key, at),
        },
        { key: submission.throttleKey, now: submission.now },
      );
      if (!admitted) return null;

      const [row] = (await runner.query(
        `INSERT INTO identity.support_request
           (account_id, sender_name, sender_email, organization_name, topic, question, reply_locale)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, reference`,
        [
          submission.sender.accountId,
          submission.sender.name,
          submission.sender.email,
          submission.sender.organizationName,
          submission.topic,
          submission.question,
          submission.replyLocale,
        ],
      )) as { id: string; reference: string }[];
      // The mail to support, on the request's own transaction (P-8): recorded and queued together or neither. Keyed by
      // the request, so a redelivered job finds the notice it already sent.
      await writeOutboxEvent(runner, {
        eventType: SUPPORT_REQUEST_RECEIVED,
        payload: { requestId: row.id },
        organizationId: null,
        idempotencyKey: `support-request/${row.id}`,
      });
      return { reference: row.reference };
    });
  }

  async read(query: { readonly id: string }): Promise<SupportRequest | null> {
    const [row] = await this.dataSource.query<
      {
        id: string;
        reference: string;
        account_id: string | null;
        sender_name: string;
        sender_email: string;
        organization_name: string | null;
        topic: string;
        question: string;
        reply_locale: string;
      }[]
    >(
      `SELECT id, reference, account_id, sender_name, sender_email, organization_name, topic, question, reply_locale
         FROM identity.support_request WHERE id = $1`,
      [query.id],
    );
    if (row === undefined) return null;
    return {
      id: row.id,
      reference: row.reference,
      sender: {
        accountId: row.account_id,
        name: row.sender_name,
        email: row.sender_email,
        organizationName: row.organization_name,
      },
      // The table's `CHECK` holds the six; narrowed rather than cast, a seventh reading as *something else*.
      topic: isSupportTopic(row.topic) ? row.topic : SUPPORT_TOPIC.OTHER,
      question: row.question,
      replyLocale: toLocale(row.reply_locale),
    };
  }

  async isOnRecord(query: { readonly reference: string }): Promise<boolean> {
    const [{ found }] = await this.dataSource.query<{ found: boolean }[]>(
      `SELECT EXISTS (SELECT 1 FROM identity.support_request WHERE reference = upper($1)) AS found`,
      [query.reference.trim()],
    );
    return found;
  }

  async purgeOlderThan(input: { readonly asOf: Date; readonly months: number }): Promise<number> {
    // Counted in a CTE so the answer is a row whatever TypeORM makes of a bare `DELETE`'s result (`returned-rows.ts`).
    const [{ deleted }] = await this.dataSource.query<{ deleted: number }[]>(
      `WITH purged AS (
         DELETE FROM identity.support_request
          WHERE sent_at < $1::timestamptz - make_interval(months => $2::int)
         RETURNING 1
       )
       SELECT count(*)::int AS deleted FROM purged`,
      [input.asOf, input.months],
    );
    return deleted;
  }

  private async inTransaction<T>(work: (runner: QueryRunner) => Promise<T>): Promise<T> {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      const result = await work(runner);
      await runner.commitTransaction();
      return result;
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }
}
