import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryRunner } from 'typeorm';
import { LOCALES, SOURCE_LOCALE, type Locale } from '@easyesg/i18n';
import type { AccountEffect } from '@api/modules/identity/account/interfaces/account-store.interface';
import type {
  Account,
  NewVerificationToken,
} from '@api/modules/identity/account/models/account.model';
import { ACCOUNT_STATUS } from '@api/modules/identity/account/models/account.model';
import {
  SocialEmailInUseError,
  SocialExchangeFailedError,
} from '@api/modules/identity/provider/errors/social.errors';
import type {
  SocialSignInStore,
  SocialSignInTransaction,
} from '@api/modules/identity/provider/interfaces/social-sign-in-store.interface';
import type {
  NewProviderAccount,
  ProviderIdentity,
} from '@api/modules/identity/provider/models/provider-identity.model';
import type { Session } from '@api/modules/identity/session/models/session.model';
import type { SocialProvider } from '@api/contracts/identity-provider.port';
import { writeOutboxEvent } from '@api/infrastructure/outbox/outbox-writer';
import { CORE_DATA_SOURCE } from '../data-source';
import { countRecentAuthAttempts, recordAuthAttempt } from './auth-attempt.queries';

/**
 * The `SocialSignInStore` adapter — the account and session repositories' shape (own transaction,
 * schema-qualified statements, `CORE_DATA_SOURCE`, the identity-schema tenancy exemption), joined
 * because task 24's one transaction spans their tables: UC-02 commits account + provider identity
 * + verification challenge + outbox row + session together (P-8).
 */
@Injectable()
export class SocialSignInStoreRepository implements SocialSignInStore {
  constructor(@InjectDataSource(CORE_DATA_SOURCE) private readonly dataSource: DataSource) {}

  async run<T>(work: (tx: SocialSignInTransaction) => Promise<T>): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const result = await work(new SocialSignInTransactionAdapter(queryRunner));
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

interface ProviderIdentityRow {
  id: string;
  account_id: string;
  provider: string;
  subject: string;
  asserted_email: string;
  email_verified_asserted: boolean;
}

interface SessionRow {
  id: string;
  account_id: string;
  created_at: Date;
  revoked_at: Date | null;
}

const toLocale = (value: string): Locale =>
  LOCALES.find((supported: Locale) => supported === value) ?? SOURCE_LOCALE;

const toAccount = (row: AccountRow): Account => ({
  id: row.id,
  email: row.email,
  status: row.status as Account['status'],
  locale: toLocale(row.locale),
  verifiedAt: row.verified_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/** The CHECK constraint guarantees membership; the cast narrows the type, not the world. */
const toProviderIdentity = (row: ProviderIdentityRow): ProviderIdentity => ({
  id: row.id,
  accountId: row.account_id,
  provider: row.provider as SocialProvider,
  subject: row.subject,
  assertedEmail: row.asserted_email,
  emailVerifiedAsserted: row.email_verified_asserted,
});

const ACCOUNT_COLUMNS = 'id, email, status, locale, verified_at, created_at, updated_at';

const PROVIDER_IDENTITY_COLUMNS =
  'id, account_id, provider, subject, asserted_email, email_verified_asserted';

/**
 * `AccountStoreRepository`'s SQLSTATE mapping, with this store's two constraints. Both races are
 * real: a password registration can commit the address between this flow's read and its insert,
 * and a double-submitted callback can race itself on the subject key. The first is BR-ID-3's
 * collision answer arriving late; the second answers "try again", and the retry signs in against
 * the row the winner created.
 */
const UNIQUE_VIOLATION = '23505';
const ACCOUNT_EMAIL_UNIQUE_INDEX = 'account_email_key';
const PROVIDER_SUBJECT_UNIQUE_CONSTRAINT = 'provider_identity_subject_key';

const uniqueViolationConstraint = (error: unknown): string | undefined => {
  const driverError = (error as { driverError?: { code?: string; constraint?: string } })
    .driverError;
  return driverError?.code === UNIQUE_VIOLATION ? driverError.constraint : undefined;
};

/** See `AccountStoreRepository.returnedRows` — TypeORM shapes `query()` results per SQL command. */
const returnedRows = <T>(result: unknown): T[] =>
  Array.isArray(result) && Array.isArray(result[0]) ? (result[0] as T[]) : (result as T[]);

class SocialSignInTransactionAdapter implements SocialSignInTransaction {
  constructor(private readonly queryRunner: QueryRunner) {}

  countRecentAuthAttempts(key: string, since: Date): Promise<number> {
    return countRecentAuthAttempts(this.queryRunner, key, since);
  }

  recordAuthAttempt(key: string, at: Date): Promise<void> {
    return recordAuthAttempt(this.queryRunner, key, at);
  }

  async findProviderIdentity(
    provider: SocialProvider,
    subject: string,
  ): Promise<ProviderIdentity | null> {
    const rows = returnedRows<ProviderIdentityRow>(
      await this.queryRunner.query(
        `SELECT ${PROVIDER_IDENTITY_COLUMNS}
           FROM identity.provider_identity
          WHERE provider = $1 AND subject = $2`,
        [provider, subject],
      ),
    );
    return rows.length > 0 ? toProviderIdentity(rows[0]) : null;
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

  async findAccountByEmail(email: string): Promise<Account | null> {
    const rows = returnedRows<AccountRow>(
      await this.queryRunner.query(
        `SELECT ${ACCOUNT_COLUMNS} FROM identity.account WHERE lower(email) = lower($1)`,
        [email],
      ),
    );
    return rows.length > 0 ? toAccount(rows[0]) : null;
  }

  async refreshProviderAssertion(
    identity: {
      readonly id: string;
      readonly assertedEmail: string;
      readonly emailVerifiedAsserted: boolean;
    },
    at: Date,
  ): Promise<void> {
    await this.queryRunner.query(
      `UPDATE identity.provider_identity
          SET asserted_email = $2, email_verified_asserted = $3, updated_at = $4
        WHERE id = $1`,
      [identity.id, identity.assertedEmail, identity.emailVerifiedAsserted, at],
    );
  }

  async markAccountVerified(accountId: string, at: Date): Promise<Account> {
    // `updated_at` by statement, not trigger — the capture trigger is `core`'s, and `identity`
    // carries none (the account repository records the same).
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
    // Cascade takes the credential, tokens AND any provider identities — OQ-52's reclaim stays
    // one statement.
    await this.queryRunner.query(`DELETE FROM identity.account WHERE id = $1`, [accountId]);
  }

  async createProviderAccount(account: NewProviderAccount): Promise<Account> {
    try {
      // Account and identity in one decision — FR-2's record: provider identity as the
      // credential, NO row in `identity.credential` ("no password set" needs no null).
      const rows = returnedRows<AccountRow>(
        await this.queryRunner.query(
          `INSERT INTO identity.account (email, locale, status, verified_at)
           VALUES ($1, $2, $3, $4)
           RETURNING ${ACCOUNT_COLUMNS}`,
          [
            account.email,
            account.locale,
            account.verifiedAt ? ACCOUNT_STATUS.ACTIVE : ACCOUNT_STATUS.UNVERIFIED,
            account.verifiedAt,
          ],
        ),
      );

      const created = toAccount(rows[0]);

      await this.queryRunner.query(
        `INSERT INTO identity.provider_identity
           (account_id, provider, subject, asserted_email, email_verified_asserted)
         VALUES ($1, $2, $3, $4, $5)`,
        [created.id, account.provider, account.subject, account.assertedEmail, account.emailVerifiedAsserted],
      );

      return created;
    } catch (error) {
      const constraint = uniqueViolationConstraint(error);
      // The index decides the race the in-flow read cannot (the account repository's argument).
      if (constraint === ACCOUNT_EMAIL_UNIQUE_INDEX) throw new SocialEmailInUseError();
      // A double-submitted callback racing itself: the winner holds the identity, so "try
      // again" is literally the resolution — the retry matches it and signs in.
      if (constraint === PROVIDER_SUBJECT_UNIQUE_CONSTRAINT) throw new SocialExchangeFailedError();
      throw error;
    }
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

  async issueVerificationToken(token: NewVerificationToken): Promise<void> {
    await this.queryRunner.query(
      `INSERT INTO identity.verification_token (account_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [token.accountId, token.tokenHash, token.expiresAt],
    );
  }

  async emit(effect: AccountEffect): Promise<void> {
    // On THIS runner (P-8, AD-6); `organizationId: null` — registration precedes every tenant.
    await writeOutboxEvent(this.queryRunner, {
      eventType: effect.eventType,
      payload: effect.payload,
      organizationId: null,
      idempotencyKey: effect.idempotencyKey,
    });
  }
}
