import {
  REFRESH_REUSE_GRACE_MS,
  hashRefreshToken,
  mintRefreshToken,
} from '@api/modules/identity/session/domain/refresh-token';
import type { AdminCookiePayload } from '../domain/admin-cookie-codec';
import {
  ADMIN_ACCESS_TOKEN_TTL_MS,
  adminSessionExpiresAt,
  adminSessionHasExpired,
} from '../domain/admin-session-expiry';
import {
  AdminSessionExpiredError,
  AdminSessionInvalidError,
} from '../errors/admin-session.errors';
import type { AdminSessionStore } from '../interfaces/admin-session-store.interface';
import type { AdminTokens } from '../interfaces/admin-token.interface';
import {
  ADMIN_SESSION_REVOKED_REASON,
  type AdminAccount,
  type AdminIdentity,
  type IssuedAdminSession,
} from '../models/admin-session.model';
import type { Clock } from '@api/contracts/clock.port';

export interface ResolveAdminSessionCommand {
  readonly payload: AdminCookiePayload;
}

/**
 * What resolving decided — current or rotated — as the closed, file-internal vocabulary the
 * house rule asks discriminators to be.
 */
const RESOLVE_OUTCOME = {
  CURRENT: 'current',
  ROTATED: 'rotated',
} as const;

export type ResolvedAdminSession =
  | {
      kind: typeof RESOLVE_OUTCOME.CURRENT;
      identity: AdminIdentity;
      sessionId: string;
    }
  | { kind: typeof RESOLVE_OUTCOME.ROTATED; issued: IssuedAdminSession };

export const RESOLVED_ADMIN_SESSION = RESOLVE_OUTCOME;

/**
 * The admin realm's per-request session judgement (task 23) — what `apps/web`'s pass-through
 * does for the tenant realm, done api-side because the api IS this realm's token handler
 * (OQ-17).
 *
 * Two tiers, and **both read the record**. A live access token is judged against the session it
 * names: a revoked session, a missing one or a deactivated account (FR-80) refuses, a lifetime run
 * out answers expired, and the identity answered is the account as it stands rather than the block
 * sealed at sign-in. That is AD-12's *the lookup, not the lifetime, bounds staleness*, and it was
 * untrue of this realm until task 145: this tier answered from the sealed payload alone, so a
 * revoked session's last access token was honoured for up to fifteen minutes — deferred to task
 * 28's guard for uniformity with the tenant model, and task 28 closed without it. §12.5.6's
 * task-145 row records the reversal and its cost, one read per admin request.
 *
 * An expired token falls through to rotation, which is task 21's exact decision tree over the
 * admin tables: revoked-session check, reuse tripwire with the 30 s race grace, expiry before
 * consumption, the conditional consume deciding races once. Rotation re-reads the account too, so
 * neither tier answers for an operator who has since been deactivated.
 *
 * **Revoked answers invalid, not expired**, where the tenant `AuthGuard` answers `session-expired`
 * for both. This realm's own contract draws the line there — `AdminSessionInvalidError` is every
 * way a cookie can be dead short of its clocks, reuse revocation included, so a thief who tripped
 * the tripwire learns nothing from the answer — and the rotation tier already answered a revoked
 * session that way. One fact, one answer, in both tiers.
 */
export class ResolveAdminSession {
  constructor(
    private readonly store: AdminSessionStore,
    private readonly tokens: AdminTokens,
    private readonly now: Clock,
  ) {}

  async execute(command: ResolveAdminSessionCommand): Promise<ResolvedAdminSession> {
    const { payload } = command;
    const sessionId = await this.tokens.verify(payload.accessToken);
    if (sessionId !== null) return this.current(sessionId);

    const now = this.now();
    const presentedHash = hashRefreshToken(payload.refreshToken);
    const next = mintRefreshToken();

    const outcome = await this.store.run<
      | { rotated: false; expired: boolean }
      | { rotated: true; account: AdminAccount; sessionId: string; sessionCreatedAt: Date }
    >(async (tx) => {
      const presented = await tx.findRefreshToken(presentedHash);
      if (presented === null || presented.sessionRevokedAt !== null) {
        return { rotated: false, expired: false };
      }

      if (presented.tokenConsumedAt !== null) {
        if (now.getTime() - presented.tokenConsumedAt.getTime() > REFRESH_REUSE_GRACE_MS) {
          await tx.revokeSession(
            presented.sessionId,
            ADMIN_SESSION_REVOKED_REASON.REFRESH_REUSED,
            now,
          );
        }
        return { rotated: false, expired: false };
      }

      if (
        adminSessionHasExpired(
          {
            sessionCreatedAt: presented.sessionCreatedAt,
            tokenIssuedAt: presented.tokenIssuedAt,
          },
          now,
        )
      ) {
        return { rotated: false, expired: true };
      }

      if (!(await tx.consumeRefreshToken(presented.tokenId, now))) {
        return { rotated: false, expired: false };
      }
      await tx.issueRefreshToken(presented.sessionId, next.hash, now);

      // Re-read rather than trust the sealed identity block: rotation is where a deactivation
      // or role change lands. An inactive account answers null and the rotation refuses.
      const account = await tx.findAdminAccountById(presented.accountId);
      if (account === null) return { rotated: false, expired: false };

      return {
        rotated: true,
        account,
        sessionId: presented.sessionId,
        sessionCreatedAt: presented.sessionCreatedAt,
      };
    });

    if (!outcome.rotated) {
      throw outcome.expired ? new AdminSessionExpiredError() : new AdminSessionInvalidError();
    }

    const accessTokenExpiresAt = new Date(now.getTime() + ADMIN_ACCESS_TOKEN_TTL_MS);
    return {
      kind: RESOLVE_OUTCOME.ROTATED,
      issued: {
        identity: {
          id: outcome.account.id,
          email: outcome.account.email,
          role: outcome.account.role,
        },
        sessionId: outcome.sessionId,
        accessToken: await this.tokens.sign(outcome.sessionId, accessTokenExpiresAt),
        accessTokenExpiresAt,
        refreshToken: next.value,
        refreshTokenExpiresAt: adminSessionExpiresAt({
          sessionCreatedAt: outcome.sessionCreatedAt,
          tokenIssuedAt: now,
        }),
      },
    };
  }

  /**
   * The live-token tier (task 145): one read, judged here rather than in the query, because the
   * lifetimes are §12.5.6's policy and `admin-session-expiry.ts` is where it is cited. Nothing is
   * written — a live access token is judged, never exchanged.
   *
   * **The checks run in rotation's order — revoked, then the lifetimes, then the account** — so a
   * session in two dead states at once answers the same whichever tier meets it. A revoked session
   * past its lifetime is invalid in both; a deactivated account past its lifetime is expired in
   * both. The first cut checked the account before the lifetimes and disagreed with rotation on the
   * second, with every test green; the gate-integrity review found the order unpinned.
   */
  private async current(sessionId: string): Promise<ResolvedAdminSession> {
    const now = this.now();
    const session = await this.store.run((tx) => tx.findSessionForRequest(sessionId));

    if (session === null || session.revokedAt !== null) throw new AdminSessionInvalidError();
    if (
      adminSessionHasExpired(
        { sessionCreatedAt: session.sessionCreatedAt, tokenIssuedAt: session.tokenIssuedAt },
        now,
      )
    ) {
      throw new AdminSessionExpiredError();
    }
    if (session.account === null) throw new AdminSessionInvalidError();

    return { kind: RESOLVE_OUTCOME.CURRENT, identity: session.account, sessionId };
  }
}
