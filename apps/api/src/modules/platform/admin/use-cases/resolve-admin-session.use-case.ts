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
import { ADMIN_SESSION_REVOKED_REASON, type AdminAccount, type IssuedAdminSession } from '../models/admin-session.model';
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
      identity: AdminCookiePayload['identity'];
      sessionId: string;
    }
  | { kind: typeof RESOLVE_OUTCOME.ROTATED; issued: IssuedAdminSession };

export const RESOLVED_ADMIN_SESSION = RESOLVE_OUTCOME;

/**
 * The admin realm's per-request session judgement (task 23) — what `apps/web`'s pass-through
 * does for the tenant realm, done api-side because the api IS this realm's token handler
 * (OQ-17).
 *
 * Two tiers, cheap first: a live access token answers from the sealed payload alone — no
 * lookup, which is the uniformity-with-the-tenant-model decision §12.5.6's task-23 paragraph
 * records, cost included (a revoked session's last access token is honoured ≤15 min until task
 * 28's guard adds the lookup). An expired one falls through to rotation, which is task 21's
 * exact decision tree over the admin tables: revoked-session check, reuse tripwire with the
 * 30 s race grace, expiry before consumption, the conditional consume deciding races once.
 * Rotation re-reads the account, so a deactivation (FR-80) takes effect at the next rotation
 * even before the guard exists.
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
    if (sessionId !== null) {
      return { kind: RESOLVE_OUTCOME.CURRENT, identity: payload.identity, sessionId };
    }

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
}
