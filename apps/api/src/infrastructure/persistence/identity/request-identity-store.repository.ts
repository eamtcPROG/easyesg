import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryRunner } from 'typeorm';
import type {
  RequestIdentityStore,
  ResolvedRequestIdentity,
} from '@api/modules/identity/session/interfaces/request-identity-store.interface';
import {
  MEMBERSHIP_STATUS,
  type AccountMembership,
  type MembershipRole,
} from '@api/modules/identity/membership/models/membership.model';
import { CORE_DATA_SOURCE } from '../data-source';

/** RFC 9562 textual form, any version — narrower checks would reject a valid future id. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface SessionRow {
  account_id: string;
  session_created_at: Date;
  token_issued_at: Date | null;
  revoked_at: Date | null;
  active_organization_id: string | null;
}

interface MembershipRow {
  id: string;
  organization_id: string;
  organization_name: string;
  role: MembershipRole;
  created_at: Date;
}

/**
 * `AuthGuard`'s read — one transaction, and the order of statements inside it is forced.
 *
 * **It cannot be a single statement, and the reason is the tenancy model rather than an
 * optimisation not taken.** Reading the memberships with their organization names requires
 * `app.current_user` to be bound, because `membership_self_select` and
 * `organization_directory_select` both read it — and the account is not known until the session has
 * been read. So it is: read the session, bind the account it names, then read the directory. Three
 * statements, one transaction, one connection. `identity.session` carries no RLS of its own (a
 * session belongs to an account, and an account exists before any organization), which is what
 * makes the first statement possible with nothing bound.
 *
 * **`app.current_org` is deliberately left unset for the whole transaction.**
 * `organization_directory_select` is conditioned on exactly that (task 25.3), so binding a tenant
 * here — which would look like diligence — would make the organization names silently disappear.
 *
 * The transaction is read-only work but a transaction all the same: `set_config(..., true)` is
 * transaction-local, and session-scoped binding is prohibited outright because PgBouncer's
 * transaction pooling would leak it to the next borrower of the connection.
 */
@Injectable()
export class RequestIdentityStoreRepository implements RequestIdentityStore {
  constructor(@InjectDataSource(CORE_DATA_SOURCE) private readonly dataSource: DataSource) {}

  async resolve(sessionId: string): Promise<ResolvedRequestIdentity | null> {
    // A token's `sub` is whatever was signed, and `identity.session.id` is a `uuid` column — so a
    // forged token carrying `sub: "hello"` would reach the query and raise `invalid input syntax
    // for type uuid`, turning a 401 into a 500 and handing the prober a signal. Shaped here rather
    // than in the guard because the column type is this adapter's knowledge, not the guard's.
    if (!UUID.test(sessionId)) return null;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const session = await this.readSession(queryRunner, sessionId);
      if (session === null) {
        await queryRunner.commitTransaction();
        return null;
      }

      await queryRunner.query('SELECT set_config($1, $2, true)', [
        'app.current_user',
        session.account_id,
      ]);
      const memberships = await this.readDirectory(queryRunner);
      await queryRunner.commitTransaction();

      return {
        accountId: session.account_id,
        anchors: {
          sessionCreatedAt: session.session_created_at,
          // A session always has a live refresh token — `createSession` writes both together, and
          // `refresh_token_live_key` keeps it to one. Falling back to the session's own creation
          // is the honest reading if that invariant ever broke: it makes the idle window start at
          // sign-in, which expires the session sooner rather than later.
          tokenIssuedAt: session.token_issued_at ?? session.session_created_at,
        },
        revokedAt: session.revoked_at,
        preferredOrganizationId: session.active_organization_id,
        memberships,
      };
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * The live refresh token is joined rather than fetched separately — it is what the idle window
   * anchors on, and `refresh_token_live_key` makes "the live one" a single row by construction.
   */
  private async readSession(runner: QueryRunner, sessionId: string): Promise<SessionRow | null> {
    const rows = (await runner.query(
      `SELECT s.account_id,
              s.created_at             AS session_created_at,
              s.revoked_at,
              s.active_organization_id,
              t.issued_at              AS token_issued_at
         FROM identity.session s
         LEFT JOIN identity.refresh_token t
           ON t.session_id = s.id AND t.consumed_at IS NULL
        WHERE s.id = $1`,
      [sessionId],
    )) as SessionRow[];
    return rows[0] ?? null;
  }

  /** Identical in shape to `AccountMembershipStoreRepository`'s read, and scoped the same way. */
  private async readDirectory(runner: QueryRunner): Promise<AccountMembership[]> {
    const rows = (await runner.query(
      `SELECT m.id, m.organization_id, o.name AS organization_name, m.role, m.created_at
         FROM identity.membership m
         JOIN core.organization o ON o.id = m.organization_id
        WHERE m.status = $1
        ORDER BY o.name, m.id`,
      [MEMBERSHIP_STATUS.ACTIVE],
    )) as MembershipRow[];

    return rows.map((row) => ({
      membershipId: row.id,
      organizationId: row.organization_id,
      organizationName: row.organization_name,
      role: row.role,
      joinedAt: row.created_at,
    }));
  }
}
