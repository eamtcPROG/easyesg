import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryRunner } from 'typeorm';
import {
  ACCOUNT_STATUS,
  PASSWORD_RESET_TOKEN_PURPOSE,
  type Account,
  type ClaimedPasswordResetToken,
} from '@api/modules/identity/account/models/account.model';
import type {
  AccountSetupStore,
  AccountSetupTransaction,
} from '@api/modules/identity/provider/interfaces/account-setup-store.interface';
import type {
  AccountSetupState,
  SetupProfile,
} from '@api/modules/identity/provider/models/account-setup.model';
import {
  SESSION_REVOKED_REASON,
  type NewSession,
  type Session,
} from '@api/modules/identity/session/models/session.model';
import { CORE_DATA_SOURCE } from '../data-source';
import { returnedRows } from '../returned-rows';
import { ACCOUNT_COLUMNS, toAccount, type AccountRow } from './account-row';

/**
 * The `AccountSetupStore` adapter (task 155) — the identity stores' shape: its own transaction,
 * schema-qualified statements, `CORE_DATA_SOURCE`, and the identity-schema exemption from
 * `TenantRepository`, since an account in setup belongs to no organization it can act for.
 */
@Injectable()
export class AccountSetupStoreRepository implements AccountSetupStore {
  constructor(@InjectDataSource(CORE_DATA_SOURCE) private readonly dataSource: DataSource) {}

  async run<T>(work: (tx: AccountSetupTransaction) => Promise<T>): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const result = await work(new AccountSetupTransactionAdapter(queryRunner));
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

interface SessionRow {
  id: string;
  account_id: string;
  created_at: Date;
  remembered: boolean;
  revoked_at: Date | null;
}

class AccountSetupTransactionAdapter implements AccountSetupTransaction {
  constructor(private readonly queryRunner: QueryRunner) {}

  async findAccountForSetup(accountId: string): Promise<AccountSetupState | null> {
    // One statement: the account, and whether a credential row exists — never the hash, which this
    // flow has no reader for (§9.1).
    const rows = (await this.queryRunner.query(
      `SELECT ${ACCOUNT_COLUMNS},
              EXISTS (SELECT 1 FROM identity.credential c WHERE c.account_id = a.id) AS password_set
         FROM identity.account a
        WHERE a.id = $1`,
      [accountId],
    )) as (AccountRow & { password_set: boolean })[];
    if (rows.length === 0) return null;
    return { account: toAccount(rows[0]), passwordSet: rows[0].password_set };
  }

  async findSessionCreatedAt(sessionId: string): Promise<Date | null> {
    const rows = (await this.queryRunner.query(
      `SELECT created_at FROM identity.session WHERE id = $1`,
      [sessionId],
    )) as { created_at: Date }[];
    return rows[0]?.created_at ?? null;
  }

  async accountSetupGrantIsLive(grantHash: Buffer, at: Date): Promise<boolean> {
    // `token_hash` is UNIQUE, so this is one index probe whatever the table holds.
    const rows = (await this.queryRunner.query(
      `SELECT EXISTS (
         SELECT 1 FROM identity.password_reset_token
          WHERE token_hash = $1 AND purpose = $2 AND consumed_at IS NULL AND expires_at > $3
       ) AS live`,
      [grantHash, PASSWORD_RESET_TOKEN_PURPOSE.ACCOUNT_SETUP, at],
    )) as { live: boolean }[];
    return rows[0]?.live === true;
  }

  async claimAccountSetupGrant(
    grantHash: Buffer,
    at: Date,
  ): Promise<ClaimedPasswordResetToken | null> {
    // The account repository's conditional UPDATE, for its single-use argument — narrowed to a grant,
    // so an emailed reset link never reaches the route that signs its holder in.
    const rows = returnedRows<{ account_id: string; expires_at: Date }>(
      await this.queryRunner.query(
        `UPDATE identity.password_reset_token
            SET consumed_at = $2
          WHERE token_hash = $1 AND purpose = $3 AND consumed_at IS NULL
          RETURNING account_id, expires_at`,
        [grantHash, at, PASSWORD_RESET_TOKEN_PURPOSE.ACCOUNT_SETUP],
      ),
    );
    if (rows.length === 0) return null;
    return { accountId: rows[0].account_id, expiresAt: rows[0].expires_at };
  }

  async insertFirstPassword(
    credential: { readonly accountId: string; readonly passwordHash: string },
    at: Date,
  ): Promise<boolean> {
    // `DO NOTHING` rather than the reset's upsert: a first password never replaces one, and the
    // primary key is what decides a race between two submissions.
    const rows = returnedRows<{ account_id: string }>(
      await this.queryRunner.query(
        `INSERT INTO identity.credential (account_id, password_hash, updated_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (account_id) DO NOTHING
         RETURNING account_id`,
        [credential.accountId, credential.passwordHash, at],
      ),
    );
    return rows.length > 0;
  }

  async saveSetupProfile(profile: SetupProfile, at: Date): Promise<Account> {
    const rows = returnedRows<AccountRow>(
      await this.queryRunner.query(
        `UPDATE identity.account
            SET given_name = $2, family_name = $3, locale = $4, updated_at = $5
          WHERE id = $1
          RETURNING ${ACCOUNT_COLUMNS}`,
        [profile.accountId, profile.givenName, profile.familyName, profile.locale, at],
      ),
    );
    return toAccount(rows[0]);
  }

  async activateAccount(accountId: string, at: Date): Promise<Account> {
    // The account repository's statement, for its reason: status and deadline move together.
    const rows = returnedRows<AccountRow>(
      await this.queryRunner.query(
        `UPDATE identity.account
            SET status = $3, setup_expires_at = NULL, updated_at = $2
          WHERE id = $1
          RETURNING ${ACCOUNT_COLUMNS}`,
        [accountId, at, ACCOUNT_STATUS.ACTIVE],
      ),
    );
    return toAccount(rows[0]);
  }

  async revokeAccountSessions(accountId: string, at: Date): Promise<void> {
    // `AccountStoreRepository.revokeAllSessionsForPasswordReset`'s statement, for FR-6's reason: the
    // grant is a reset token, and consuming one ends every session the account held.
    await this.queryRunner.query(
      `UPDATE identity.session
          SET revoked_at = $2, revoked_reason = $3
        WHERE account_id = $1 AND revoked_at IS NULL`,
      [accountId, at, SESSION_REVOKED_REASON.PASSWORD_RESET],
    );
  }

  async createSession(session: NewSession): Promise<Session> {
    // `SocialSignInStoreRepository.createSession`'s two statements — session and first token together.
    const rows = returnedRows<SessionRow>(
      await this.queryRunner.query(
        `INSERT INTO identity.session (account_id, created_at, remembered)
         VALUES ($1, $2, $3)
         RETURNING id, account_id, created_at, remembered, revoked_at`,
        [session.accountId, session.at, session.remembered],
      ),
    );

    await this.queryRunner.query(
      `INSERT INTO identity.refresh_token (session_id, token_hash, issued_at)
       VALUES ($1, $2, $3)`,
      [rows[0].id, session.refreshTokenHash, session.at],
    );

    return {
      id: rows[0].id,
      accountId: rows[0].account_id,
      createdAt: rows[0].created_at,
      remembered: rows[0].remembered,
      revokedAt: rows[0].revoked_at,
    };
  }
}
