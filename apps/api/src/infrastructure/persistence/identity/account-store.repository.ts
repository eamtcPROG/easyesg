import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryRunner } from 'typeorm';
import { toLocale } from '@easyesg/i18n';
import { EmailAlreadyRegisteredError } from '@api/modules/identity/account/errors/account.errors';
import type {
  AccountEffect,
  AccountStore,
  AccountTransaction,
} from '@api/modules/identity/account/interfaces/account-store.interface';
import {
  ACCOUNT_STATUS,
  type Account,
  type ClaimedPasswordResetToken,
  type ClaimedVerificationToken,
  type NewAccount,
  type NewPasswordResetToken,
  type NewVerificationToken,
} from '@api/modules/identity/account/models/account.model';
import { SESSION_REVOKED_REASON } from '@api/modules/identity/session/models/session.model';
import { writeOutboxEvent } from '@api/infrastructure/outbox/outbox-writer';
import { CORE_DATA_SOURCE } from '../data-source';
import { countRecentAuthAttempts, recordAuthAttempt } from './auth-attempt.queries';

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

/**
 * `23505` is PostgreSQL's `unique_violation` SQLSTATE. The constraint name is what says *which*
 * uniqueness failed.
 *
 * Both are named rather than compared as bare literals (CLAUDE.md, "Conventions"), and here the
 * rule's stated rationale is exactly the failure mode: a typo in either makes the comparison
 * quietly false, the branch never fires, and a duplicate registration answers `500` instead of
 * OQ-53's `409` — a wrong status on a path with an e2e test that would still pass, because the
 * test asserts the 409 comes back and would simply see the 500 as the whole endpoint breaking.
 *
 * `ACCOUNT_EMAIL_UNIQUE_INDEX` mirrors the index name in `1787356800000-identity-account.ts`,
 * which stays literal there because a migration is frozen history. Two copies, deliberately,
 * changed together by hand — the same shape as an `as const` object mirroring a CHECK.
 */
const UNIQUE_VIOLATION = '23505';
const ACCOUNT_EMAIL_UNIQUE_INDEX = 'account_email_key';

const isEmailUniqueViolation = (error: unknown): boolean => {
  const driverError = (error as { driverError?: { code?: string; constraint?: string } }).driverError;
  return (
    driverError?.code === UNIQUE_VIOLATION &&
    driverError.constraint === ACCOUNT_EMAIL_UNIQUE_INDEX
  );
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

  countRecentAuthAttempts(key: string, since: Date): Promise<number> {
    return countRecentAuthAttempts(this.queryRunner, key, since);
  }

  recordAuthAttempt(key: string, at: Date): Promise<void> {
    return recordAuthAttempt(this.queryRunner, key, at);
  }

  async invalidateOutstandingPasswordResetTokens(accountId: string, at: Date): Promise<void> {
    // `consumed_at` means "no longer usable", as on the verification table — a reissue leaves
    // exactly one live challenge.
    await this.queryRunner.query(
      `UPDATE identity.password_reset_token
          SET consumed_at = $2
        WHERE account_id = $1 AND consumed_at IS NULL`,
      [accountId, at],
    );
  }

  async issuePasswordResetToken(token: NewPasswordResetToken): Promise<void> {
    await this.queryRunner.query(
      `INSERT INTO identity.password_reset_token (account_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [token.accountId, token.tokenHash, token.expiresAt],
    );
  }

  async claimPasswordResetToken(
    tokenHash: Buffer,
    at: Date,
  ): Promise<ClaimedPasswordResetToken | null> {
    // The same conditional UPDATE as `claimVerificationToken`, for the same single-use argument.
    const rows = returnedRows<{ account_id: string; expires_at: Date }>(
      await this.queryRunner.query(
        `UPDATE identity.password_reset_token
            SET consumed_at = $2
          WHERE token_hash = $1 AND consumed_at IS NULL
          RETURNING account_id, expires_at`,
        [tokenHash, at],
      ),
    );
    if (rows.length === 0) return null;
    return { accountId: rows[0].account_id, expiresAt: rows[0].expires_at };
  }

  async replaceCredentialPassword(
    credential: { readonly accountId: string; readonly passwordHash: string },
    at: Date,
  ): Promise<boolean> {
    // One statement replaces the hash AND releases the lockout — §12.5.6 names the consumed
    // reset link as a release, and separating the two would create a state where one happened
    // without the other.
    const rows = returnedRows<{ account_id: string }>(
      await this.queryRunner.query(
        `UPDATE identity.credential
            SET password_hash = $2, failed_attempts = 0, locked_at = NULL, updated_at = $3
          WHERE account_id = $1
          RETURNING account_id`,
        [credential.accountId, credential.passwordHash, at],
      ),
    );
    return rows.length > 0;
  }

  async revokeAllSessionsForPasswordReset(accountId: string, at: Date): Promise<void> {
    await this.queryRunner.query(
      `UPDATE identity.session
          SET revoked_at = $2, revoked_reason = $3
        WHERE account_id = $1 AND revoked_at IS NULL`,
      [accountId, at, SESSION_REVOKED_REASON.PASSWORD_RESET],
    );
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
