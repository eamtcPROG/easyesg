import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryRunner } from 'typeorm';
import type {
  AdminSessionStore,
  AdminSessionTransaction,
} from '@api/modules/platform/admin/interfaces/admin-session-store.interface';
import {
  ADMIN_ROLE,
  type AdminAccount,
  type AdminRole,
  type AdminSession,
  type AdminSessionRevokedReason,
  type PresentedAdminRefreshToken,
} from '@api/modules/platform/admin/models/admin-session.model';
import { CORE_DATA_SOURCE } from '../data-source';
import { countRecentAuthAttempts, recordAuthAttempt } from '../identity/auth-attempt.queries';

/**
 * The `AdminSessionStore` adapter — `SessionStoreRepository`'s shape over the admin tables
 * (task 23). Same exemption: the admin realm exists before and outside any tenant, so nothing
 * here extends `TenantRepository`; same discipline: every mutation is a conditional statement
 * deciding a race exactly once.
 */
@Injectable()
export class AdminSessionStoreRepository implements AdminSessionStore {
  constructor(@InjectDataSource(CORE_DATA_SOURCE) private readonly dataSource: DataSource) {}

  async run<T>(work: (tx: AdminSessionTransaction) => Promise<T>): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const result = await work(new AdminSessionTransactionAdapter(queryRunner));
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

/** Rows as PostgreSQL returns them: snake_case, `timestamptz` parsed to `Date` by `pg`. */
interface AdminAccountRow {
  id: string;
  email: string;
  role: string;
  active: boolean;
  password_hash: string;
  totp_secret: string;
  failed_attempts: number;
  locked_at: Date | null;
  created_at: Date;
}

interface AdminSessionRow {
  id: string;
  account_id: string;
  created_at: Date;
  revoked_at: Date | null;
}

interface PresentedAdminRefreshTokenRow {
  token_id: string;
  session_id: string;
  account_id: string;
  token_issued_at: Date;
  token_consumed_at: Date | null;
  session_created_at: Date;
  session_revoked_at: Date | null;
}

const toRole = (value: string): AdminRole =>
  Object.values(ADMIN_ROLE).find((role) => role === value) ?? ADMIN_ROLE.PLATFORM_ADMINISTRATOR;

const toAdminAccount = (row: AdminAccountRow): AdminAccount => ({
  id: row.id,
  email: row.email,
  role: toRole(row.role),
  active: row.active,
  passwordHash: row.password_hash,
  totpSecret: row.totp_secret,
  failedAttempts: row.failed_attempts,
  lockedAt: row.locked_at,
  createdAt: row.created_at,
});

const ADMIN_ACCOUNT_COLUMNS =
  'id, email, role, active, password_hash, totp_secret, failed_attempts, locked_at, created_at';

/** See `AccountStoreRepository.returnedRows` — TypeORM shapes `query()` results per SQL command. */
const returnedRows = <T>(result: unknown): T[] =>
  Array.isArray(result) && Array.isArray(result[0]) ? (result[0] as T[]) : (result as T[]);

class AdminSessionTransactionAdapter implements AdminSessionTransaction {
  constructor(private readonly queryRunner: QueryRunner) {}

  countRecentAuthAttempts(key: string, since: Date): Promise<number> {
    return countRecentAuthAttempts(this.queryRunner, key, since);
  }

  recordAuthAttempt(key: string, at: Date): Promise<void> {
    return recordAuthAttempt(this.queryRunner, key, at);
  }

  async findAdminAccountByEmail(email: string): Promise<AdminAccount | null> {
    const rows = returnedRows<AdminAccountRow>(
      await this.queryRunner.query(
        `SELECT ${ADMIN_ACCOUNT_COLUMNS} FROM identity.admin_account
          WHERE email = $1 AND active`,
        [email],
      ),
    );
    return rows.length === 0 ? null : toAdminAccount(rows[0]);
  }

  async findAdminAccountById(accountId: string): Promise<AdminAccount | null> {
    const rows = returnedRows<AdminAccountRow>(
      await this.queryRunner.query(
        `SELECT ${ADMIN_ACCOUNT_COLUMNS} FROM identity.admin_account
          WHERE id = $1 AND active`,
        [accountId],
      ),
    );
    return rows.length === 0 ? null : toAdminAccount(rows[0]);
  }

  async registerFailedSignIn(accountId: string, threshold: number, at: Date): Promise<void> {
    // One atomic UPDATE: two concurrent failures that both read 9 must not both write
    // 10-and-unlocked (the session store's argument, unchanged).
    await this.queryRunner.query(
      `UPDATE identity.admin_account
          SET failed_attempts = failed_attempts + 1,
              locked_at = CASE WHEN failed_attempts + 1 >= $2 THEN $3 ELSE locked_at END,
              updated_at = $3
        WHERE id = $1`,
      [accountId, threshold, at],
    );
  }

  async clearFailedSignIns(accountId: string): Promise<void> {
    await this.queryRunner.query(
      `UPDATE identity.admin_account
          SET failed_attempts = 0, updated_at = now()
        WHERE id = $1 AND failed_attempts <> 0`,
      [accountId],
    );
  }

  async createSession(
    accountId: string,
    refreshTokenHash: Buffer,
    at: Date,
  ): Promise<AdminSession> {
    const rows = returnedRows<AdminSessionRow>(
      await this.queryRunner.query(
        `INSERT INTO identity.admin_session (account_id, created_at)
         VALUES ($1, $2)
         RETURNING id, account_id, created_at, revoked_at`,
        [accountId, at],
      ),
    );
    const session = rows[0];
    await this.queryRunner.query(
      `INSERT INTO identity.admin_refresh_token (session_id, token_hash, issued_at)
       VALUES ($1, $2, $3)`,
      [session.id, refreshTokenHash, at],
    );
    return {
      id: session.id,
      accountId: session.account_id,
      createdAt: session.created_at,
      revokedAt: session.revoked_at,
    };
  }

  async findRefreshToken(tokenHash: Buffer): Promise<PresentedAdminRefreshToken | null> {
    const rows = returnedRows<PresentedAdminRefreshTokenRow>(
      await this.queryRunner.query(
        `SELECT t.id AS token_id,
                t.session_id,
                s.account_id,
                t.issued_at AS token_issued_at,
                t.consumed_at AS token_consumed_at,
                s.created_at AS session_created_at,
                s.revoked_at AS session_revoked_at
           FROM identity.admin_refresh_token t
           JOIN identity.admin_session s ON s.id = t.session_id
          WHERE t.token_hash = $1`,
        [tokenHash],
      ),
    );
    if (rows.length === 0) return null;
    const row = rows[0];
    return {
      tokenId: row.token_id,
      sessionId: row.session_id,
      accountId: row.account_id,
      tokenIssuedAt: row.token_issued_at,
      tokenConsumedAt: row.token_consumed_at,
      sessionCreatedAt: row.session_created_at,
      sessionRevokedAt: row.session_revoked_at,
    };
  }

  async consumeRefreshToken(tokenId: string, at: Date): Promise<boolean> {
    // The conditional UPDATE that decides rotation races once — `RETURNING id` so the answer
    // is read from rows, never from the per-command result shape (the session store's note).
    const result = (await this.queryRunner.query(
      `UPDATE identity.admin_refresh_token
          SET consumed_at = $2
        WHERE id = $1 AND consumed_at IS NULL
        RETURNING id`,
      [tokenId, at],
    )) as unknown;
    return returnedRows<{ id: string }>(result).length > 0;
  }

  async issueRefreshToken(sessionId: string, tokenHash: Buffer, at: Date): Promise<void> {
    await this.queryRunner.query(
      `INSERT INTO identity.admin_refresh_token (session_id, token_hash, issued_at)
       VALUES ($1, $2, $3)`,
      [sessionId, tokenHash, at],
    );
  }

  async revokeSession(
    sessionId: string,
    reason: AdminSessionRevokedReason,
    at: Date,
  ): Promise<void> {
    await this.queryRunner.query(
      `UPDATE identity.admin_session
          SET revoked_at = $2, revoked_reason = $3
        WHERE id = $1 AND revoked_at IS NULL`,
      [sessionId, at, reason],
    );
  }
}
