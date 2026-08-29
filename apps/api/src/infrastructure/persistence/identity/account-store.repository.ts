import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryRunner } from 'typeorm';
import { toLocale } from '@easyesg/i18n';
import { SECRET_CIPHER, type SecretCipher } from '@api/contracts/secret-cipher.port';
import { EmailAlreadyRegisteredError } from '@api/modules/identity/account/errors/account.errors';
import { hashInvitationToken } from '@api/modules/identity/invitation/domain/invitation-token';
import type { InvitationStatus } from '@api/modules/identity/invitation/models/invitation.model';
import type {
  AccountEffect,
  AccountStore,
  AccountTransaction,
  PresentedInvitation,
} from '@api/modules/identity/account/interfaces/account-store.interface';
import {
  ACCOUNT_STATUS,
  type Account,
  type Credential,
  type ClaimedPasswordResetToken,
  type ClaimedVerificationToken,
  type NewAccount,
  type NewPasswordResetToken,
  type NewVerificationToken,
} from '@api/modules/identity/account/models/account.model';
import {
  RECOVERY_CODE_OUTCOME,
  type RecoveryCodeOutcome,
  type TotpEnrolment,
} from '@api/modules/identity/account/models/totp.model';
import { SESSION_REVOKED_REASON } from '@api/modules/identity/session/models/session.model';
import { writeOutboxEvent } from '@api/infrastructure/outbox/outbox-writer';
import { CORE_DATA_SOURCE } from '../data-source';
import { returnedRows } from '../returned-rows';
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
  constructor(
    @InjectDataSource(CORE_DATA_SOURCE) private readonly dataSource: DataSource,
    // Task 27.2's second factor: `identity.totp_credential.secret` is sealed here and opened
    // here, and nowhere else (§12.5.6's secrets-at-rest row, task 27.1).
    @Inject(SECRET_CIPHER) private readonly secrets: SecretCipher,
  ) {}

  async run<T>(work: (tx: AccountTransaction) => Promise<T>): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const result = await work(new AccountTransactionAdapter(queryRunner, this.secrets));
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

class AccountTransactionAdapter implements AccountTransaction {
  constructor(
    private readonly queryRunner: QueryRunner,
    private readonly secrets: SecretCipher,
  ) {}

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

  /**
   * Reads the invitation a registration presented, through `invitation_bearer_select` (task 26.2).
   *
   * **The binding is what makes this reachable at all.** `identity.invitation` is tenant-scoped and
   * this transaction has no organization bound — registration precedes every tenant — so without
   * `app.current_invitation` the read returns zero rows and every registration would proceed
   * unverified, silently. The setting is transaction-local, so it is gone when this unit of work
   * ends and no other statement in it is affected.
   *
   * **This adapter hashes; the wire never carries a hash.** A route accepting one would make the
   * stored value the credential, which is what NFR-64's SHA-256-at-rest rule denies. Hex rather
   * than a `::bytea` cast, because a cast reads PostgreSQL's escape format and a hash containing
   * `0x5c` would decode to something other than itself — a silent miss on one token in 256.
   *
   * No `WHERE token_hash = $1`: the policy scopes the read, and a predicate restating it would be
   * the second source of truth every repository here avoids.
   */
  async findPresentedInvitation(token: string): Promise<PresentedInvitation | null> {
    await this.queryRunner.query('SELECT set_config($1, $2, true)', [
      'app.current_invitation',
      hashInvitationToken(token).toString('hex'),
    ]);

    const rows = returnedRows<{ invited_email: string; status: InvitationStatus; expires_at: Date }>(
      await this.queryRunner.query(
        `SELECT invited_email, status, expires_at FROM identity.invitation`,
      ),
    );

    const row = rows[0];
    if (row === undefined) return null;
    return { invitedEmail: row.invited_email, status: row.status, expiresAt: row.expires_at };
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

  async revokeOtherSessionsForPasswordChange(
    scope: { readonly accountId: string; readonly exceptSessionId: string },
    at: Date,
  ): Promise<number> {
    // `id <> $2` is FR-7's word "other", in SQL. One statement, so a session opened between a
    // read and a write cannot slip through the gap a read-then-write would leave.
    const result: unknown = await this.queryRunner.query(
      `UPDATE identity.session
          SET revoked_at = $3, revoked_reason = $4
        WHERE account_id = $1 AND id <> $2 AND revoked_at IS NULL
       RETURNING id`,
      [scope.accountId, scope.exceptSessionId, at, SESSION_REVOKED_REASON.PASSWORD_CHANGED],
    );
    // UPDATE … RETURNING arrives as [rows, count] — see `returnedRows`.
    return returnedRows<{ id: string }>(result).length;
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

  // ── The opt-in second factor (task 27.2) ────────────────────────────────────────────────────

  async findCredential(accountId: string): Promise<Credential | null> {
    const rows = returnedRows<{
      account_id: string;
      password_hash: string;
      failed_attempts: number;
      locked_at: Date | null;
    }>(
      await this.queryRunner.query(
        `SELECT account_id, password_hash, failed_attempts, locked_at
           FROM identity.credential WHERE account_id = $1`,
        [accountId],
      ),
    );
    // Null is the provider-only account (FR-2), which holds no credential row at all — see the
    // port's note on why that is a decision and not a gap.
    return rows.length === 0
      ? null
      : {
          accountId: rows[0].account_id,
          passwordHash: rows[0].password_hash,
          failedAttempts: rows[0].failed_attempts,
          lockedAt: rows[0].locked_at,
        };
  }

  async findTotpEnrolment(accountId: string): Promise<TotpEnrolment | null> {
    const rows = returnedRows<{ account_id: string; secret: string; confirmed_at: Date | null }>(
      await this.queryRunner.query(
        `SELECT account_id, secret, confirmed_at FROM identity.totp_credential
          WHERE account_id = $1`,
        [accountId],
      ),
    );
    return rows.length === 0
      ? null
      : {
          accountId: rows[0].account_id,
          // Opened here, so the domain type holds the secret and not its storage form. A throw
          // means a wrong SECRET_ENCRYPTION_KEY or a corrupt row, never "no factor".
          secret: this.secrets.open(rows[0].secret),
          confirmedAt: rows[0].confirmed_at,
        };
  }

  async beginTotpEnrolment(
    enrolment: { readonly accountId: string; readonly secret: string },
    at: Date,
  ): Promise<boolean> {
    // One conditional statement deciding the race once, the house discipline. `WHERE confirmed_at
    // IS NULL` on the DO UPDATE is what refuses to overwrite a working factor — a read-then-write
    // would let two requests both see "unconfirmed" and the second replace a secret the first had
    // just confirmed.
    const rows = returnedRows<{ account_id: string }>(
      await this.queryRunner.query(
        `INSERT INTO identity.totp_credential (account_id, secret, created_at, updated_at)
         VALUES ($1, $2, $3, $3)
         ON CONFLICT (account_id) DO UPDATE
            SET secret = EXCLUDED.secret, updated_at = $3
          WHERE identity.totp_credential.confirmed_at IS NULL
         RETURNING account_id`,
        [enrolment.accountId, this.secrets.seal(enrolment.secret), at],
      ),
    );
    return rows.length > 0;
  }

  async confirmTotpEnrolment(accountId: string, at: Date): Promise<boolean> {
    const result: unknown = await this.queryRunner.query(
      `UPDATE identity.totp_credential SET confirmed_at = $2, updated_at = $2
        WHERE account_id = $1 AND confirmed_at IS NULL
       RETURNING account_id`,
      [accountId, at],
    );
    // UPDATE … RETURNING arrives as [rows, count] — see `returnedRows`.
    return returnedRows<{ account_id: string }>(result).length > 0;
  }

  async deleteTotpEnrolment(accountId: string): Promise<void> {
    await this.queryRunner.query(
      `DELETE FROM identity.totp_credential WHERE account_id = $1`,
      [accountId],
    );
  }

  async replaceRecoveryCodes(accountId: string, hashes: readonly Buffer[]): Promise<void> {
    await this.queryRunner.query(
      `DELETE FROM identity.recovery_code WHERE account_id = $1`,
      [accountId],
    );
    if (hashes.length === 0) return;
    // One statement rather than a loop: ten round trips inside a transaction hold a pooled
    // connection for no reason, and `unnest` keeps the parameter count at two whatever the count
    // becomes.
    await this.queryRunner.query(
      `INSERT INTO identity.recovery_code (account_id, code_hash)
       SELECT $1, h FROM unnest($2::bytea[]) AS h`,
      [accountId, hashes],
    );
  }

  async countUnspentRecoveryCodes(accountId: string): Promise<number> {
    const rows = returnedRows<{ remaining: string }>(
      await this.queryRunner.query(
        `SELECT count(*)::text AS remaining FROM identity.recovery_code
          WHERE account_id = $1 AND spent_at IS NULL`,
        [accountId],
      ),
    );
    // `count(*)` is bigint, which `pg` hands back as a STRING to avoid losing precision past 2^53.
    // Parsing it here is the conversion the port's `number` promises; letting it through would
    // make `remaining === 0` false for the string '0'.
    return Number.parseInt(rows[0].remaining, 10);
  }

  async spendRecoveryCode(
    presented: { readonly accountId: string; readonly codeHash: Buffer },
    at: Date,
  ): Promise<RecoveryCodeOutcome> {
    const spent: unknown = await this.queryRunner.query(
      `UPDATE identity.recovery_code SET spent_at = $3
        WHERE account_id = $1 AND code_hash = $2 AND spent_at IS NULL
       RETURNING id`,
      [presented.accountId, presented.codeHash, at],
    );
    if (returnedRows<{ id: string }>(spent).length > 0) return RECOVERY_CODE_OUTCOME.SPENT;

    // Nothing was spent. Whether the code is unknown or already used is a difference a DEFENDER
    // wants — a replay of a code that once worked is evidence someone holds a copy — so the store
    // answers it. The use case then collapses both into one refusal (NFR-64).
    const known = returnedRows<{ id: string }>(
      await this.queryRunner.query(
        `SELECT id FROM identity.recovery_code WHERE account_id = $1 AND code_hash = $2`,
        [presented.accountId, presented.codeHash],
      ),
    );
    return known.length > 0
      ? RECOVERY_CODE_OUTCOME.ALREADY_SPENT
      : RECOVERY_CODE_OUTCOME.UNKNOWN;
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
