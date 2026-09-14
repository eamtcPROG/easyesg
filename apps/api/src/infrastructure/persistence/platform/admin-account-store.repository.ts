import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryRunner } from 'typeorm';
import { writeOutboxEvent } from '@api/infrastructure/outbox/outbox-writer';
import {
  ADMIN_INVITATION_ISSUED,
  type AdminInvitationIssued,
} from '@api/modules/platform/admin/constants/admin-invitation.constants';
import { AdminInvitationOutstandingError } from '@api/modules/platform/admin/errors/admin-invitation.errors';
import type {
  AdminAccountStore,
  AdminAccountTransaction,
} from '@api/modules/platform/admin/interfaces/admin-account-store.interface';
import {
  ADMIN_INVITATION_STATUS,
  type AdminInvitation,
} from '@api/modules/platform/admin/models/admin-invitation.model';
import type {
  AdminAccountRecord,
  AdminRoster,
  AdminRosterAccount,
} from '@api/modules/platform/admin/models/admin-roster.model';
import {
  ADMIN_ACCOUNT_STATUS,
  ADMIN_ROLE,
  isAdminAccountStatus,
  isAdminRole,
  type AdminAccountStatus,
  type AdminRole,
  type AdminSessionRevokedReason,
} from '@api/modules/platform/admin/models/admin-session.model';
import { collated } from '../collation';
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
 * A-08's store adapter (task 67.4) — `AdminSessionStoreRepository`'s unit-of-work shape over the
 * accounts, their sessions and their invitations. No `TenantRepository`: the realm exists outside any
 * organization, and its tables carry no row security.
 *
 * **It opens no secret.** Nothing A-08 does needs the password hash or the TOTP secret, so no statement
 * here selects either, and the cipher is not injected — which makes *the lifecycle cannot leak a
 * credential* a property of the constructor rather than of care.
 *
 * **Every conditional write decides a race exactly once**, as the session store's do: a status change,
 * a release, a reissue and a revoke each name the state they expect in their `WHERE`, and answer from
 * the rows returned rather than from what a prior read said.
 */
@Injectable()
export class AdminAccountStoreRepository implements AdminAccountStore {
  constructor(@InjectDataSource(CORE_DATA_SOURCE) private readonly dataSource: DataSource) {}

  async run<T>(work: (tx: AdminAccountTransaction) => Promise<T>): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const result = await work(new AdminAccountTransactionAdapter(queryRunner));
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

interface AdminAccountRecordRow {
  id: string;
  email: string;
  role: string;
  status: string;
  locked_at: Date | null;
}

interface AdminRosterAccountRow extends AdminAccountRecordRow {
  last_sign_in_at: Date | null;
}

/** An unknown role or status reads as no account — `admin-invitation-rows.ts` states the reason once. */
const toAccountRecord = (row: AdminAccountRecordRow): AdminAccountRecord | null =>
  isAdminRole(row.role) && isAdminAccountStatus(row.status)
    ? { id: row.id, email: row.email, role: row.role, status: row.status, lockedAt: row.locked_at }
    : null;

/**
 * **The lifecycle lock's name.** One lock for the realm, not one per account, because the rule it
 * protects — the last active Platform Administrator — is about all of them at once. Hashed, which is
 * AD-7's objection for fiscal numbering and harmless here: a collision makes two unrelated writers
 * wait on each other for one transaction, never a wrong count (the seat lock's reading).
 */
const LIFECYCLE_LOCK = 'identity.admin_account.lifecycle';

const PENDING_EMAIL_UNIQUE_INDEX = 'admin_invitation_pending_email_key';

class AdminAccountTransactionAdapter implements AdminAccountTransaction {
  constructor(private readonly runner: QueryRunner) {}

  countRecentAuthAttempts(key: string, since: Date): Promise<number> {
    return countRecentAuthAttempts(this.runner, key, since);
  }

  recordAuthAttempt(key: string, at: Date): Promise<void> {
    return recordAuthAttempt(this.runner, key, at);
  }

  async readRoster(): Promise<AdminRoster> {
    // Last sign-in is the newest session opened, sign-in rather than activity — A-02's column's
    // reading, for the same reason: a rotation is not a person arriving. `admin_session_account_idx`
    // serves the correlated max.
    const accounts = (await this.runner.query(
      `SELECT a.id, a.email, a.role, a.status, a.locked_at,
              (SELECT max(s.created_at) FROM identity.admin_session s WHERE s.account_id = a.id)
                AS last_sign_in_at
         FROM identity.admin_account a
        ORDER BY ${collated('a.email')}, a.id`,
    )) as AdminRosterAccountRow[];

    const invitations = (await this.runner.query(
      `SELECT ${ADMIN_INVITATION_COLUMNS} FROM identity.admin_invitation
        WHERE status = $1
        ORDER BY ${collated('email')}, id`,
      [ADMIN_INVITATION_STATUS.PENDING],
    )) as AdminInvitationRow[];

    return {
      accounts: accounts.flatMap((row): AdminRosterAccount[] => {
        const record = toAccountRecord(row);
        return record === null ? [] : [{ ...record, lastSignInAt: row.last_sign_in_at }];
      }),
      invitations: invitations.flatMap((row) => toAdminInvitation(row) ?? []),
    };
  }

  async findAccount(accountId: string): Promise<AdminAccountRecord | null> {
    const rows = (await this.runner.query(
      `SELECT id, email, role, status, locked_at FROM identity.admin_account WHERE id = $1`,
      [accountId],
    )) as AdminAccountRecordRow[];
    return rows.length === 0 ? null : toAccountRecord(rows[0]);
  }

  async countActivePlatformAdministratorsUnderLock(): Promise<number> {
    await this.runner.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [LIFECYCLE_LOCK]);
    const rows = (await this.runner.query(
      `SELECT count(*)::int AS active FROM identity.admin_account WHERE role = $1 AND status = $2`,
      [ADMIN_ROLE.PLATFORM_ADMINISTRATOR, ADMIN_ACCOUNT_STATUS.ACTIVE],
    )) as { active: number }[];
    return rows[0].active;
  }

  async changeStatus(input: {
    readonly accountId: string;
    readonly from: readonly AdminAccountStatus[];
    readonly to: AdminAccountStatus;
    readonly at: Date;
  }): Promise<boolean> {
    const result: unknown = await this.runner.query(
      `UPDATE identity.admin_account
          SET status = $2, updated_at = $3
        WHERE id = $1 AND status = ANY($4::text[])
        RETURNING id`,
      [input.accountId, input.to, input.at, [...input.from]],
    );
    return returnedRows<{ id: string }>(result).length > 0;
  }

  async revokeSessions(input: {
    readonly accountId: string;
    readonly reason: AdminSessionRevokedReason;
    readonly at: Date;
  }): Promise<void> {
    await this.runner.query(
      `UPDATE identity.admin_session
          SET revoked_at = $2, revoked_reason = $3
        WHERE account_id = $1 AND revoked_at IS NULL`,
      [input.accountId, input.at, input.reason],
    );
  }

  async releaseLockout(input: { readonly accountId: string; readonly at: Date }): Promise<boolean> {
    const result: unknown = await this.runner.query(
      `UPDATE identity.admin_account
          SET locked_at = NULL, failed_attempts = 0, updated_at = $2
        WHERE id = $1 AND locked_at IS NOT NULL AND status <> $3
        RETURNING id`,
      [input.accountId, input.at, ADMIN_ACCOUNT_STATUS.REMOVED],
    );
    return returnedRows<{ id: string }>(result).length > 0;
  }

  async hasLiveAccountWithEmail(email: string): Promise<boolean> {
    const rows = (await this.runner.query(
      `SELECT 1 FROM identity.admin_account WHERE email = $1 AND status <> $2`,
      [email, ADMIN_ACCOUNT_STATUS.REMOVED],
    )) as unknown[];
    return rows.length > 0;
  }

  async issueInvitation(input: {
    readonly email: string;
    readonly role: AdminRole;
    readonly invitedBy: string;
    readonly tokenHash: Buffer;
    readonly issuedAt: Date;
    readonly expiresAt: Date;
  }): Promise<AdminInvitation> {
    try {
      const rows = (await this.runner.query(
        `INSERT INTO identity.admin_invitation
           (email, role, invited_by, token_hash, issued_at, expires_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $5, $5)
         RETURNING ${ADMIN_INVITATION_COLUMNS}`,
        [input.email, input.role, input.invitedBy, input.tokenHash, input.issuedAt, input.expiresAt],
      )) as AdminInvitationRow[];

      const invitation = toAdminInvitation(rows[0]);
      // The row this statement wrote, from values this adapter's own types admitted.
      if (invitation === null) throw new Error('An invitation just written could not be read back.');
      return invitation;
    } catch (error) {
      if (violatesUniqueIndex({ error, index: PENDING_EMAIL_UNIQUE_INDEX })) {
        throw new AdminInvitationOutstandingError();
      }
      throw error;
    }
  }

  async findInvitation(invitationId: string): Promise<AdminInvitation | null> {
    const rows = (await this.runner.query(
      `SELECT ${ADMIN_INVITATION_COLUMNS} FROM identity.admin_invitation WHERE id = $1`,
      [invitationId],
    )) as AdminInvitationRow[];
    return rows.length === 0 ? null : toAdminInvitation(rows[0]);
  }

  async reissueInvitationToken(input: {
    readonly invitationId: string;
    readonly tokenHash: Buffer;
    readonly issuedAt: Date;
    readonly expiresAt: Date;
  }): Promise<boolean> {
    const result: unknown = await this.runner.query(
      `UPDATE identity.admin_invitation
          SET token_hash = $2, issued_at = $3, expires_at = $4, totp_secret = NULL, updated_at = $3
        WHERE id = $1 AND status = $5
        RETURNING id`,
      [
        input.invitationId,
        input.tokenHash,
        input.issuedAt,
        input.expiresAt,
        ADMIN_INVITATION_STATUS.PENDING,
      ],
    );
    return returnedRows<{ id: string }>(result).length > 0;
  }

  async revokeInvitation(input: { readonly invitationId: string; readonly at: Date }): Promise<boolean> {
    const result: unknown = await this.runner.query(
      `UPDATE identity.admin_invitation
          SET status = $2, updated_at = $3
        WHERE id = $1 AND status = $4
        RETURNING id`,
      [
        input.invitationId,
        ADMIN_INVITATION_STATUS.REVOKED,
        input.at,
        ADMIN_INVITATION_STATUS.PENDING,
      ],
    );
    return returnedRows<{ id: string }>(result).length > 0;
  }

  async emitInvitationEmail(input: {
    readonly event: AdminInvitationIssued;
    readonly expiresAt: Date;
  }): Promise<void> {
    await writeOutboxEvent(this.runner, {
      eventType: ADMIN_INVITATION_ISSUED,
      payload: { ...input.event },
      // A platform event, bound to no organization — and the key carries the expiry, so a resend is new
      // work to the queue rather than a duplicate of the issue it replaced.
      organizationId: null,
      idempotencyKey: `${ADMIN_INVITATION_ISSUED}:${input.event.invitationId}:${input.expiresAt.getTime()}`,
    });
  }
}
