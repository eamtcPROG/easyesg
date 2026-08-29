import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryRunner } from 'typeorm';
import { toLocale } from '@easyesg/i18n';
import type {
  Account,
  Credential,
} from '@api/modules/identity/account/models/account.model';
import type {
  SessionStore,
  SessionTransaction,
} from '@api/modules/identity/session/interfaces/session-store.interface';
import type {
  PresentedRefreshToken,
  Session,
  SessionRevokedReason,
} from '@api/modules/identity/session/models/session.model';
import { CORE_DATA_SOURCE } from '../data-source';
import { returnedRows } from '../returned-rows';
import { countRecentAuthAttempts, recordAuthAttempt } from './auth-attempt.queries';

/**
 * The `SessionStore` adapter — `AccountStoreRepository`'s shape (own transaction, schema-
 * qualified statements, `CORE_DATA_SOURCE`), and its exemption: `modules/identity/*` runs before
 * a tenant exists, so nothing here extends `TenantRepository`.
 *
 * Every mutation is a conditional statement deciding a race exactly once — consume-if-unconsumed,
 * revoke-if-unrevoked, lock-at-threshold — because sessions are the one table family where two
 * legitimate requests routinely collide (a double-refresh, a sign-out crossing a refresh) and
 * read-then-write would let both through.
 */
@Injectable()
export class SessionStoreRepository implements SessionStore {
  constructor(@InjectDataSource(CORE_DATA_SOURCE) private readonly dataSource: DataSource) {}

  async run<T>(work: (tx: SessionTransaction) => Promise<T>): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const result = await work(new SessionTransactionAdapter(queryRunner));
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
interface AccountRow {
  id: string;
  email: string;
  status: string;
  locale: string;
  verified_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface CredentialRow {
  account_id: string;
  password_hash: string;
  failed_attempts: number;
  locked_at: Date | null;
}

interface SessionRow {
  id: string;
  account_id: string;
  created_at: Date;
  revoked_at: Date | null;
}

interface PresentedRefreshTokenRow {
  token_id: string;
  session_id: string;
  account_id: string;
  token_issued_at: Date;
  token_consumed_at: Date | null;
  session_created_at: Date;
  session_revoked_at: Date | null;
}

const toAccount = (row: AccountRow): Account => ({
  id: row.id,
  email: row.email,
  status: row.status as Account['status'],
  locale: toLocale(row.locale),
  verifiedAt: row.verified_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const ACCOUNT_COLUMNS = 'id, email, status, locale, verified_at, created_at, updated_at';


class SessionTransactionAdapter implements SessionTransaction {
  constructor(private readonly queryRunner: QueryRunner) {}

  countRecentAuthAttempts(key: string, since: Date): Promise<number> {
    return countRecentAuthAttempts(this.queryRunner, key, since);
  }

  recordAuthAttempt(key: string, at: Date): Promise<void> {
    return recordAuthAttempt(this.queryRunner, key, at);
  }

  async findAccountByEmail(email: string): Promise<Account | null> {
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

  async findCredential(accountId: string): Promise<Credential | null> {
    const rows = returnedRows<CredentialRow>(
      await this.queryRunner.query(
        `SELECT account_id, password_hash, failed_attempts, locked_at
           FROM identity.credential WHERE account_id = $1`,
        [accountId],
      ),
    );
    if (rows.length === 0) return null;
    return {
      accountId: rows[0].account_id,
      passwordHash: rows[0].password_hash,
      failedAttempts: rows[0].failed_attempts,
      lockedAt: rows[0].locked_at,
    };
  }

  async registerFailedSignIn(accountId: string, threshold: number, at: Date): Promise<void> {
    // One atomic statement: the increment and the at-threshold lock decide together, so two
    // concurrent ninth failures cannot both read 9 and neither lock. COALESCE keeps an existing
    // lock's instant — the first lock is the fact; later failures do not move it.
    await this.queryRunner.query(
      `UPDATE identity.credential
          SET failed_attempts = failed_attempts + 1,
              locked_at = CASE WHEN failed_attempts + 1 >= $2 THEN COALESCE(locked_at, $3)
                               ELSE locked_at END,
              updated_at = $3
        WHERE account_id = $1`,
      [accountId, threshold, at],
    );
  }

  async clearFailedSignIns(accountId: string): Promise<void> {
    // Conditional so the common path — a correct password on a clean credential — writes nothing.
    await this.queryRunner.query(
      `UPDATE identity.credential
          SET failed_attempts = 0
        WHERE account_id = $1 AND failed_attempts <> 0`,
      [accountId],
    );
  }

  async createSession(accountId: string, refreshTokenHash: Buffer, at: Date): Promise<Session> {
    const rows = returnedRows<SessionRow>(
      await this.queryRunner.query(
        `INSERT INTO identity.session (account_id, created_at)
         VALUES ($1, $2)
         RETURNING id, account_id, created_at, revoked_at`,
        [accountId, at],
      ),
    );

    await this.queryRunner.query(
      `INSERT INTO identity.refresh_token (session_id, token_hash, issued_at)
       VALUES ($1, $2, $3)`,
      [rows[0].id, refreshTokenHash, at],
    );

    return {
      id: rows[0].id,
      accountId: rows[0].account_id,
      createdAt: rows[0].created_at,
      revokedAt: rows[0].revoked_at,
    };
  }

  async findRefreshToken(tokenHash: Buffer): Promise<PresentedRefreshToken | null> {
    const rows = returnedRows<PresentedRefreshTokenRow>(
      await this.queryRunner.query(
        `SELECT t.id AS token_id, t.session_id, s.account_id,
                t.issued_at AS token_issued_at, t.consumed_at AS token_consumed_at,
                s.created_at AS session_created_at, s.revoked_at AS session_revoked_at
           FROM identity.refresh_token t
           JOIN identity.session s ON s.id = t.session_id
          WHERE t.token_hash = $1`,
        [tokenHash],
      ),
    );
    if (rows.length === 0) return null;
    return {
      tokenId: rows[0].token_id,
      sessionId: rows[0].session_id,
      accountId: rows[0].account_id,
      tokenIssuedAt: rows[0].token_issued_at,
      tokenConsumedAt: rows[0].token_consumed_at,
      sessionCreatedAt: rows[0].session_created_at,
      sessionRevokedAt: rows[0].session_revoked_at,
    };
  }

  async consumeRefreshToken(tokenId: string, at: Date): Promise<boolean> {
    // The conditional UPDATE that makes rotation single-use under concurrency — PostgreSQL
    // decides `consumed_at IS NULL` once, and the second of two simultaneous refreshes updates
    // zero rows (see `claimVerificationToken`, which established the pattern).
    const result = (await this.queryRunner.query(
      `UPDATE identity.refresh_token
          SET consumed_at = $2
        WHERE id = $1 AND consumed_at IS NULL
        RETURNING id`,
      [tokenId, at],
    )) as unknown;
    return returnedRows<{ id: string }>(result).length > 0;
  }

  async issueRefreshToken(sessionId: string, tokenHash: Buffer, at: Date): Promise<void> {
    await this.queryRunner.query(
      `INSERT INTO identity.refresh_token (session_id, token_hash, issued_at)
       VALUES ($1, $2, $3)`,
      [sessionId, tokenHash, at],
    );
  }

  async revokeSession(sessionId: string, reason: SessionRevokedReason, at: Date): Promise<void> {
    // Conditional for the CHECK's sake as much as the race's: the first revocation is the fact,
    // and overwriting its reason would rewrite why a session died.
    await this.queryRunner.query(
      `UPDATE identity.session
          SET revoked_at = $2, revoked_reason = $3
        WHERE id = $1 AND revoked_at IS NULL`,
      [sessionId, at, reason],
    );
  }
}
