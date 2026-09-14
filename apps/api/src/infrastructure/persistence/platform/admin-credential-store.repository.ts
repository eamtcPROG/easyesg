import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryRunner } from 'typeorm';
import { SECRET_CIPHER, type SecretCipher } from '@api/contracts/secret-cipher.port';
import type {
  AdminCredentialStore,
  AdminCredentialTransaction,
  AdminOperatorCredential,
} from '@api/modules/platform/admin/interfaces/admin-credential-store.interface';
import type { AdminCredentialState } from '@api/modules/platform/admin/models/admin-credentials.model';
import {
  ADMIN_ACCOUNT_STATUS,
  type AdminSessionRevokedReason,
} from '@api/modules/platform/admin/models/admin-session.model';
import { CORE_DATA_SOURCE } from '../data-source';
import { countRecentAuthAttempts, recordAuthAttempt } from '../identity/auth-attempt.queries';
import { returnedRows } from '../returned-rows';

/**
 * A-19's store adapter (task 144) — the session store's unit-of-work shape over an operator's own
 * password, staged second factor and recovery codes. No `TenantRepository`: the realm exists outside any
 * organization.
 *
 * **It seals and opens the staged secret, and nothing else here does** — task 27.1's rule that encryption at
 * rest happens at the persistence boundary, so no use case learns the column is sealed. The factor in force
 * is never read by this adapter at all: a promotion copies one sealed column into the other inside the
 * database, so putting a new factor in force opens nothing it does not have to.
 *
 * **Every conditional write names the state it expects**, as the realm's other adapters do: a staging only
 * on an active account, a promotion only while something is staged, a revocation only of a live session.
 */
@Injectable()
export class AdminCredentialStoreRepository implements AdminCredentialStore {
  constructor(
    @InjectDataSource(CORE_DATA_SOURCE) private readonly dataSource: DataSource,
    @Inject(SECRET_CIPHER) private readonly secrets: SecretCipher,
  ) {}

  async run<T>(work: (tx: AdminCredentialTransaction) => Promise<T>): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const result = await work(new AdminCredentialTransactionAdapter(queryRunner, this.secrets));
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

class AdminCredentialTransactionAdapter implements AdminCredentialTransaction {
  constructor(
    private readonly runner: QueryRunner,
    private readonly secrets: SecretCipher,
  ) {}

  countRecentAuthAttempts(key: string, since: Date): Promise<number> {
    return countRecentAuthAttempts(this.runner, key, since);
  }

  recordAuthAttempt(key: string, at: Date): Promise<void> {
    return recordAuthAttempt(this.runner, key, at);
  }

  async findCredential(accountId: string): Promise<AdminOperatorCredential | null> {
    const rows = returnedRows<{ email: string; password_hash: string }>(
      await this.runner.query(
        `SELECT email, password_hash FROM identity.admin_account WHERE id = $1 AND status = $2`,
        [accountId, ADMIN_ACCOUNT_STATUS.ACTIVE],
      ),
    );
    return rows.length === 0 ? null : { email: rows[0].email, passwordHash: rows[0].password_hash };
  }

  async replacePassword(input: {
    readonly accountId: string;
    readonly passwordHash: string;
    readonly at: Date;
  }): Promise<void> {
    await this.runner.query(
      `UPDATE identity.admin_account SET password_hash = $2, updated_at = $3 WHERE id = $1`,
      [input.accountId, input.passwordHash, input.at],
    );
  }

  async revokeOtherSessions(input: {
    readonly accountId: string;
    readonly exceptSessionId: string;
    readonly reason: AdminSessionRevokedReason;
    readonly at: Date;
  }): Promise<number> {
    const result = (await this.runner.query(
      `UPDATE identity.admin_session
          SET revoked_at = $3, revoked_reason = $4
        WHERE account_id = $1 AND id <> $2 AND revoked_at IS NULL
        RETURNING id`,
      [input.accountId, input.exceptSessionId, input.at, input.reason],
    )) as unknown;
    return returnedRows<{ id: string }>(result).length;
  }

  async stageTotpSecret(input: {
    readonly accountId: string;
    readonly secret: string;
    readonly at: Date;
  }): Promise<boolean> {
    const result = (await this.runner.query(
      `UPDATE identity.admin_account
          SET staged_totp_secret = $2, updated_at = $3
        WHERE id = $1 AND status = $4
        RETURNING id`,
      [input.accountId, this.secrets.seal(input.secret), input.at, ADMIN_ACCOUNT_STATUS.ACTIVE],
    )) as unknown;
    return returnedRows<{ id: string }>(result).length > 0;
  }

  async findStagedTotpSecretForUpdate(accountId: string): Promise<string | null> {
    const rows = returnedRows<{ staged_totp_secret: string | null }>(
      await this.runner.query(
        `SELECT staged_totp_secret FROM identity.admin_account
          WHERE id = $1 AND status = $2
          FOR UPDATE`,
        [accountId, ADMIN_ACCOUNT_STATUS.ACTIVE],
      ),
    );
    const sealed = rows[0]?.staged_totp_secret ?? null;
    // `open` throws on a secret that will not open, the realm store's reading: a wrong key or a corrupt
    // row is an operator misconfiguration, never "nothing staged".
    return sealed === null ? null : this.secrets.open(sealed);
  }

  async promoteStagedTotpSecret(input: { readonly accountId: string; readonly at: Date }): Promise<void> {
    await this.runner.query(
      `UPDATE identity.admin_account
          SET totp_secret = staged_totp_secret, staged_totp_secret = NULL, updated_at = $2
        WHERE id = $1 AND staged_totp_secret IS NOT NULL`,
      [input.accountId, input.at],
    );
  }

  async replaceRecoveryCodes(input: {
    readonly accountId: string;
    readonly hashes: readonly Buffer[];
    readonly at: Date;
  }): Promise<void> {
    await this.runner.query(`DELETE FROM identity.admin_recovery_code WHERE account_id = $1`, [
      input.accountId,
    ]);
    await this.runner.query(
      `INSERT INTO identity.admin_recovery_code (account_id, code_hash, issued_at)
       SELECT $1, code_hash, $3 FROM unnest($2::bytea[]) AS code_hash`,
      [input.accountId, [...input.hashes], input.at],
    );
  }

  async readCredentialState(accountId: string): Promise<AdminCredentialState> {
    const rows = returnedRows<{ issued_at: Date | null; remaining: number }>(
      await this.runner.query(
        `SELECT max(issued_at) AS issued_at,
                (count(*) FILTER (WHERE spent_at IS NULL))::int AS remaining
           FROM identity.admin_recovery_code
          WHERE account_id = $1`,
        [accountId],
      ),
    );
    return {
      recoveryCodesIssuedAt: rows[0]?.issued_at ?? null,
      recoveryCodesRemaining: rows[0]?.remaining ?? 0,
    };
  }
}
