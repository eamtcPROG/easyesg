import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryRunner } from 'typeorm';
import { LOCALES, SOURCE_LOCALE, type Locale } from '@easyesg/i18n';
import { EmailAlreadyRegisteredError } from '@api/modules/identity/account/errors/account.errors';
import type {
  AccountEffect,
  AccountStore,
  AccountTransaction,
} from '@api/modules/identity/account/interfaces/account-store.interface';
import {
  ACCOUNT_STATUS,
  type Account,
  type ClaimedVerificationToken,
  type NewAccount,
  type NewVerificationToken,
} from '@api/modules/identity/account/models/account.model';
import { writeOutboxEvent } from '@api/infrastructure/outbox/outbox-writer';
import { CORE_DATA_SOURCE } from '../data-source';

/**
 * The `AccountStore` adapter — §6.7 puts repositories in `infrastructure/persistence/`.
 *
 * **It does not extend `TenantRepository`, and that is one of the exemptions that base class names
 * in its own header:** `modules/identity/*` runs before a tenant exists. There is no
 * `app.current_org` to bind at registration because UC-01 precedes UC-49 by definition, so this
 * opens its own transaction rather than borrowing the request's — which `TenantTransactionGuard`
 * correctly declines to open when no organization is bound.
 *
 * It uses `CORE_DATA_SOURCE` for the `identity` schema. That is not a mismatch: AD-14 constraint 3
 * fixes **two** DataSources, split on the DR-1 boundary rather than on schema, and `identity`,
 * `core`, `config` and `audit` are all reached through the first. Every statement is
 * schema-qualified, as the baseline requires, because TypeORM's postgres driver sets no
 * `search_path`.
 */
@Injectable()
export class AccountStoreRepository implements AccountStore {
  constructor(@InjectDataSource(CORE_DATA_SOURCE) private readonly dataSource: DataSource) {}

  async run<T>(work: (tx: AccountTransaction) => Promise<T>): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const result = await work(new AccountTransactionAdapter(queryRunner));
      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      // Guarded rather than unconditional: a failed commit leaves no active transaction, and
      // rolling back an inactive one would replace the real error with a driver complaint about
      // the rollback.
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      // Always. A runner released on neither path is a connection never returned to a pool of ten,
      // which presents as the application hanging under load rather than as an error here.
      await queryRunner.release();
    }
  }
}

/** Rows as PostgreSQL returns them: snake_case, and `timestamptz` already parsed to `Date` by `pg`. */
interface AccountRow {
  id: string;
  email: string;
  status: string;
  locale: string;
  verified_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface VerificationTokenRow {
  account_id: string;
  token_hash: Buffer;
  expires_at: Date;
}

/**
 * A stored locale that is no longer a live one — a locale retired after accounts were created in it
 * — must not make a record unreadable. Falling back to the source locale is what FR-10's own
 * fallback rule already does per string; doing it here keeps the type honest instead of asserting
 * `as Locale` over whatever the column happens to hold.
 */
const toLocale = (value: string): Locale =>
  LOCALES.find((supported: Locale) => supported === value) ?? SOURCE_LOCALE;

const toAccount = (row: AccountRow): Account => ({
  id: row.id,
  email: row.email,
  // The CHECK constraint `account_status_known` is what makes this narrowing safe; it is asserted
  // rather than re-validated because a status the database rejects cannot be in a row.
  status: row.status as Account['status'],
  locale: toLocale(row.locale),
  verifiedAt: row.verified_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/** `23505` is `unique_violation`. The constraint name is what says *which* uniqueness failed. */
const isEmailUniqueViolation = (error: unknown): boolean => {
  const driverError = (error as { driverError?: { code?: string; constraint?: string } }).driverError;
  return driverError?.code === '23505' && driverError.constraint === 'account_email_key';
};

const ACCOUNT_COLUMNS = 'id, email, status, locale, verified_at, created_at, updated_at';

/**
 * Normalises what `queryRunner.query()` returns, because **TypeORM shapes it differently per SQL
 * command** and the difference is invisible until it bites.
 *
 * `SELECT` and `INSERT ... RETURNING` yield the rows. `UPDATE ... RETURNING` and
 * `DELETE ... RETURNING` yield `[rows, rowCount]` — the driver builds `raw` with a switch on
 * `command`. So the same `RETURNING` clause reads as `rows[0].token_hash` after an INSERT and as
 * `undefined` after an UPDATE, with no error at the call site: the failure surfaces further down
 * as a `TypeError` on a property of something that was supposed to be a row.
 *
 * It cost one debugging cycle here, on `claimVerificationToken`, and would have cost another on
 * `markAccountVerified` immediately after. Every row-returning statement in this file goes through
 * this, so the next `UPDATE ... RETURNING` written here cannot reintroduce it.
 */
const returnedRows = <T>(result: unknown): T[] =>
  Array.isArray(result) && Array.isArray(result[0]) ? (result[0] as T[]) : (result as T[]);

class AccountTransactionAdapter implements AccountTransaction {
  constructor(private readonly queryRunner: QueryRunner) {}

  async insertUnverifiedAccount(account: NewAccount): Promise<Account> {
    try {
      // Two statements, one transaction. The credential is a separate row so that a password hash
      // is never in the row an account read maps to a DTO (see the migration).
      const rows = returnedRows<AccountRow>(
        await this.queryRunner.query(
          `INSERT INTO identity.account (email, locale)
           VALUES ($1, $2)
           RETURNING ${ACCOUNT_COLUMNS}`,
          [account.email, account.locale],
        ),
      );

      const created = toAccount(rows[0]);

      await this.queryRunner.query(
        `INSERT INTO identity.credential (account_id, password_hash) VALUES ($1, $2)`,
        [created.id, account.passwordHash],
      );

      return created;
    } catch (error) {
      // The unique index is the duplicate check, not the caller's prior read — two simultaneous
      // registrations of one address both pass a read-then-write test and one of them is wrong.
      if (isEmailUniqueViolation(error)) throw new EmailAlreadyRegisteredError();
      throw error;
    }
  }

  async findAccountByEmail(email: string): Promise<Account | null> {
    // `lower(email) = lower($1)`, matching `account_email_key` exactly — the index is functional,
    // so a comparison written any other way would not use it and, worse, would disagree with what
    // uniqueness actually enforces.
    const rows = returnedRows<AccountRow>(
      await this.queryRunner.query(
        `SELECT ${ACCOUNT_COLUMNS} FROM identity.account WHERE lower(email) = lower($1)`,
        [email],
      ),
    );
    return rows.length > 0 ? toAccount(rows[0]) : null;
  }

  async findAccountById(accountId: string): Promise<Account | null> {
    const rows = returnedRows<AccountRow>(
      await this.queryRunner.query(
        `SELECT ${ACCOUNT_COLUMNS} FROM identity.account WHERE id = $1`,
        [accountId],
      ),
    );
    return rows.length > 0 ? toAccount(rows[0]) : null;
  }

  async issueVerificationToken(token: NewVerificationToken): Promise<void> {
    await this.queryRunner.query(
      `INSERT INTO identity.verification_token (account_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [token.accountId, token.tokenHash, token.expiresAt],
    );
  }

  async invalidateOutstandingVerificationTokens(accountId: string, at: Date): Promise<void> {
    await this.queryRunner.query(
      `UPDATE identity.verification_token
          SET consumed_at = $2
        WHERE account_id = $1 AND consumed_at IS NULL`,
      [accountId, at],
    );
  }

  async claimVerificationToken(
    tokenHash: Buffer,
    at: Date,
  ): Promise<ClaimedVerificationToken | null> {
    // The conditional UPDATE is what makes single-use true under concurrency: PostgreSQL decides
    // `consumed_at IS NULL` once, and the second of two simultaneous requests updates zero rows.
    // A `SELECT` followed by an `UPDATE` would let both through, and the window is exactly as wide
    // as a double-clicked link.
    const rows = returnedRows<VerificationTokenRow>(
      await this.queryRunner.query(
        `UPDATE identity.verification_token
            SET consumed_at = $2
          WHERE token_hash = $1 AND consumed_at IS NULL
          RETURNING account_id, token_hash, expires_at`,
        [tokenHash, at],
      ),
    );

    if (rows.length === 0) return null;
    return {
      accountId: rows[0].account_id,
      tokenHash: rows[0].token_hash,
      expiresAt: rows[0].expires_at,
    };
  }

  async markAccountVerified(accountId: string, at: Date): Promise<Account> {
    // `updated_at` is maintained here rather than by a trigger. `core.organization` gets it from
    // the per-field capture trigger (task 14), which is scoped to `core` — `identity` carries no
    // capture, so the column is the statement's responsibility.
    const rows = returnedRows<AccountRow>(
      await this.queryRunner.query(
        `UPDATE identity.account
            SET status = $3, verified_at = $2, updated_at = $2
          WHERE id = $1
          RETURNING ${ACCOUNT_COLUMNS}`,
        [accountId, at, ACCOUNT_STATUS.ACTIVE],
      ),
    );
    return toAccount(rows[0]);
  }

  async deleteAccount(accountId: string): Promise<void> {
    // The credential and any outstanding tokens go with it, by `ON DELETE CASCADE`. That is what
    // makes OQ-52's "the record is deleted" a single statement rather than a sequence someone can
    // get half-right.
    await this.queryRunner.query(`DELETE FROM identity.account WHERE id = $1`, [accountId]);
  }

  async emit(effect: AccountEffect): Promise<void> {
    // On THIS runner, which is the whole reason the port exposes `emit` on the transaction rather
    // than as a separate dependency (P-8, AD-6). `organizationId: null` because an account belongs
    // to no tenant — registration precedes every organization.
    await writeOutboxEvent(this.queryRunner, {
      eventType: effect.eventType,
      payload: effect.payload,
      organizationId: null,
      idempotencyKey: effect.idempotencyKey,
    });
  }
}
