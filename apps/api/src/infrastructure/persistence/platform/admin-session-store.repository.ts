import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryRunner } from 'typeorm';
import { SECRET_CIPHER, type SecretCipher } from '@api/contracts/secret-cipher.port';
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
 *
 * **This is where encryption at rest happens, and nowhere else** (task 27.1; §12.5.6's
 * secrets-at-rest row). `identity.admin_account.totp_secret` is stored sealed, and it is opened
 * here on the way out, exactly as OQ-50 puts the `timestamptz` → epoch-ms conversion at this
 * same boundary: `AdminAccount.totpSecret` is the secret, and no use case, domain function or
 * DTO learns that the column is encrypted. The alternative — handing the cipher to
 * `CompleteAdminSignIn` — would have made every future reader of a secret responsible for
 * remembering to open it, which is the failure mode the store exists to remove.
 *
 * **A recorded cost:** `findAdminAccountById` serves the resolve path, which reads only the
 * identity fields — so every `GET /auth/admin/session` opens a secret it will not use. Returning
 * it sealed from one finder and open from the other was rejected outright: `AdminAccount
 * .totpSecret` would then be a type that lies about what it holds, which is a worse defect class
 * than one AES-GCM over twenty bytes. A lazily-opening getter was rejected for the same family of
 * reason — a property that throws at an arbitrary later point. If the plaintext window ever needs
 * narrowing, the honest change is a second model without the field, not a field that varies.
 */
@Injectable()
export class AdminSessionStoreRepository implements AdminSessionStore {
  constructor(
    @InjectDataSource(CORE_DATA_SOURCE) private readonly dataSource: DataSource,
    @Inject(SECRET_CIPHER) private readonly secrets: SecretCipher,
  ) {}

  async run<T>(work: (tx: AdminSessionTransaction) => Promise<T>): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const result = await work(new AdminSessionTransactionAdapter(queryRunner, this.secrets));
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

/**
 * The row is the storage representation; `AdminAccount` is the domain's. `totp_secret` arrives
 * sealed and is opened here — a throw if it cannot be, because a secret that will not open is a
 * wrong `SECRET_ENCRYPTION_KEY` or a corrupt row, and answering "no secret" would present an
 * operator misconfiguration as a mistyped code on the factor step.
 */
const toAdminAccount = (row: AdminAccountRow, secrets: SecretCipher): AdminAccount => ({
  id: row.id,
  email: row.email,
  role: toRole(row.role),
  active: row.active,
  passwordHash: row.password_hash,
  totpSecret: secrets.open(row.totp_secret),
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
  constructor(
    private readonly queryRunner: QueryRunner,
    private readonly secrets: SecretCipher,
  ) {}

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
    return rows.length === 0 ? null : toAdminAccount(rows[0], this.secrets);
  }

  async findAdminAccountById(accountId: string): Promise<AdminAccount | null> {
    const rows = returnedRows<AdminAccountRow>(
      await this.queryRunner.query(
        `SELECT ${ADMIN_ACCOUNT_COLUMNS} FROM identity.admin_account
          WHERE id = $1 AND active`,
        [accountId],
      ),
    );
    return rows.length === 0 ? null : toAdminAccount(rows[0], this.secrets);
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
