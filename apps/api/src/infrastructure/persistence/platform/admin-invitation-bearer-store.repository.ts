import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryRunner } from 'typeorm';
import { SECRET_CIPHER, type SecretCipher } from '@api/contracts/secret-cipher.port';
import { AdminAccountExistsError } from '@api/modules/platform/admin/errors/admin-accounts.errors';
import type {
  AdminInvitationBearerStore,
  AdminInvitationBearerTransaction,
} from '@api/modules/platform/admin/interfaces/admin-invitation-bearer-store.interface';
import {
  ADMIN_INVITATION_STATUS,
  type PresentedAdminInvitation,
} from '@api/modules/platform/admin/models/admin-invitation.model';
import type { AdminRole } from '@api/modules/platform/admin/models/admin-session.model';
import { CORE_DATA_SOURCE } from '../data-source';
import { countRecentAuthAttempts, recordAuthAttempt } from '../identity/auth-attempt.queries';
import { returnedRows } from '../returned-rows';
import {
  ADMIN_INVITATION_COLUMNS,
  toAdminInvitation,
  violatesUniqueIndex,
  type AdminInvitationRow,
} from './admin-invitation-rows';

/**
 * A-20's store adapter (task 67.4) — what the bearer of an administrator invitation's link reaches.
 *
 * **The staged factor is sealed here and opened here, and nowhere else** (task 27.1's rule):
 * `identity.admin_invitation.totp_secret` is `identity.encrypted_secret`, so the database refuses a
 * plaintext value, and the use cases hold the base32 secret without learning the column is encrypted.
 * The account it becomes is sealed the same way, into the column the sign-in path already opens.
 */
@Injectable()
export class AdminInvitationBearerStoreRepository implements AdminInvitationBearerStore {
  constructor(
    @InjectDataSource(CORE_DATA_SOURCE) private readonly dataSource: DataSource,
    @Inject(SECRET_CIPHER) private readonly secrets: SecretCipher,
  ) {}

  async run<T>(work: (tx: AdminInvitationBearerTransaction) => Promise<T>): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const result = await work(new AdminInvitationBearerTransactionAdapter(queryRunner, this.secrets));
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

interface PresentedAdminInvitationRow extends AdminInvitationRow {
  totp_secret: string | null;
}

const LIVE_ACCOUNT_EMAIL_UNIQUE_INDEX = 'admin_account_live_email_key';

class AdminInvitationBearerTransactionAdapter implements AdminInvitationBearerTransaction {
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

  async findInvitationByTokenHash(tokenHash: Buffer): Promise<PresentedAdminInvitation | null> {
    const rows = (await this.runner.query(
      `SELECT ${ADMIN_INVITATION_COLUMNS}, totp_secret FROM identity.admin_invitation
        WHERE token_hash = $1`,
      [tokenHash],
    )) as PresentedAdminInvitationRow[];
    if (rows.length === 0) return null;

    const invitation = toAdminInvitation(rows[0]);
    if (invitation === null) return null;
    // `open` throws on a secret that will not open — a wrong key or a corrupt row, never "no secret".
    const stagedTotpSecret = rows[0].totp_secret === null ? null : this.secrets.open(rows[0].totp_secret);
    return { ...invitation, stagedTotpSecret };
  }

  async stageTotpSecret(input: {
    readonly invitationId: string;
    readonly secret: string;
    readonly at: Date;
  }): Promise<string | null> {
    // `COALESCE` keeps a secret already staged: the second of two simultaneous requests answers the
    // first's secret rather than overwriting the one its tab scanned.
    const result: unknown = await this.runner.query(
      `UPDATE identity.admin_invitation
          SET totp_secret = COALESCE(totp_secret, $2::identity.encrypted_secret), updated_at = $3
        WHERE id = $1 AND status = $4
        RETURNING totp_secret`,
      [input.invitationId, this.secrets.seal(input.secret), input.at, ADMIN_INVITATION_STATUS.PENDING],
    );
    const rows = returnedRows<{ totp_secret: string }>(result);
    return rows.length === 0 ? null : this.secrets.open(rows[0].totp_secret);
  }

  async accept(input: {
    readonly invitationId: string;
    readonly email: string;
    readonly role: AdminRole;
    readonly passwordHash: string;
    readonly totpSecret: string;
    readonly at: Date;
  }): Promise<string | null> {
    // The claim first: it is what decides two acceptances racing, so the account is written only by
    // the transaction that won it.
    const claimed: unknown = await this.runner.query(
      `UPDATE identity.admin_invitation
          SET status = $2, updated_at = $3
        WHERE id = $1 AND status = $4
        RETURNING id`,
      [input.invitationId, ADMIN_INVITATION_STATUS.ACCEPTED, input.at, ADMIN_INVITATION_STATUS.PENDING],
    );
    if (returnedRows<{ id: string }>(claimed).length === 0) return null;

    try {
      const rows = (await this.runner.query(
        `INSERT INTO identity.admin_account
           (email, role, password_hash, totp_secret, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $5)
         RETURNING id`,
        [input.email, input.role, input.passwordHash, this.secrets.seal(input.totpSecret), input.at],
      )) as { id: string }[];
      return rows[0].id;
    } catch (error) {
      if (violatesUniqueIndex({ error, index: LIVE_ACCOUNT_EMAIL_UNIQUE_INDEX })) {
        throw new AdminAccountExistsError();
      }
      throw error;
    }
  }
}
