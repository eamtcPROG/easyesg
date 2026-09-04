import type { Account } from '@api/modules/identity/account/models/account.model';
import { REFRESH_REUSE_GRACE_MS, hashRefreshToken, mintRefreshToken } from '../domain/refresh-token';
import { ACCESS_TOKEN_TTL_MS, sessionExpiresAt, sessionHasExpired } from '../domain/session-expiry';
import { SessionExpiredError, SessionInvalidError } from '../errors/session.errors';
import type { AccessTokenSigner } from '../interfaces/access-token-signer.interface';
import type { SessionStore } from '../interfaces/session-store.interface';
import { SESSION_REVOKED_REASON, type IssuedSession } from '../models/session.model';
import type { Clock } from '@api/contracts/clock.port';

export interface RefreshSessionCommand {
  readonly refreshToken: string;
}

/**
 * What the transaction decided, as a closed vocabulary — the house rule (apps/api/CLAUDE.md)
 * names a **discriminator** among the shapes it covers, and this one had its three values
 * written as literals at eight sites.
 *
 * Declared in this file and unexported, which is the part of the rule worth stating rather than
 * assuming: `ACCOUNT_STATUS` lives in `models/` because it is a domain vocabulary the database,
 * the DTO and three use cases all share, whereas this is internal control flow with no reader
 * outside `execute`. "Declared once" means one declaration, not one location for every kind.
 */
const REFRESH_OUTCOME = {
  INVALID: 'invalid',
  EXPIRED: 'expired',
  ROTATED: 'rotated',
} as const;

type RefreshOutcome =
  | { kind: typeof REFRESH_OUTCOME.INVALID }
  | { kind: typeof REFRESH_OUTCOME.EXPIRED }
  | {
      kind: typeof REFRESH_OUTCOME.ROTATED;
      account: Account;
      sessionId: string;
      sessionCreatedAt: Date;
      /** Which of §12.5.6's two pairs bounds this session — read from the row, never re-decided. */
      sessionRemembered: boolean;
    };

/**
 * AD-12's rotation: consume the presented refresh token, issue its successor, sign a fresh
 * access token — or refuse, in one of exactly two distinguishable ways (see the errors file for
 * where that boundary runs and why).
 *
 * The decision tree runs inside ONE transaction, and the ordering inside it is the security
 * content:
 *
 *  - **Revoked session first**: nothing presented against a revoked session does anything.
 *  - **Consumed token next — the reuse signal.** A token consumed longer ago than the race
 *    grace means someone holds a copy that rotation already retired: the session is revoked on
 *    the spot (that write is the transaction's reason to exist — it commits although the caller
 *    gets a refusal, because the outcome is returned rather than thrown). The refusal itself is
 *    indistinguishable from any other invalid token, so tripping the wire is silent.
 *  - **Expiry before consumption**: an expired session's token is left unconsumed, so the row
 *    still says what happened when someone asks the database later.
 *  - **The conditional consume decides races once**, exactly as `claimVerificationToken` argues:
 *    of two concurrent refreshes, PostgreSQL picks the winner, and the loser is a plain refusal
 *    — inside the grace, not a revocation.
 *
 * FR-58's shape holds here too: the rotated session carries no role or organization, so nothing
 * is re-snapshotted — the guard reads those per request (AD-12).
 */
export class RefreshSession {
  constructor(
    private readonly store: SessionStore,
    private readonly signer: AccessTokenSigner,
    private readonly now: Clock,
  ) {}

  async execute(command: RefreshSessionCommand): Promise<IssuedSession> {
    const now = this.now();
    const presentedHash = hashRefreshToken(command.refreshToken);
    const next = mintRefreshToken();

    const outcome = await this.store.run<RefreshOutcome>(async (tx) => {
      const presented = await tx.findRefreshToken(presentedHash);
      if (presented === null || presented.sessionRevokedAt !== null) {
        return { kind: REFRESH_OUTCOME.INVALID };
      }

      if (presented.tokenConsumedAt !== null) {
        if (now.getTime() - presented.tokenConsumedAt.getTime() > REFRESH_REUSE_GRACE_MS) {
          await tx.revokeSession(presented.sessionId, SESSION_REVOKED_REASON.REFRESH_REUSED, now);
        }
        return { kind: REFRESH_OUTCOME.INVALID };
      }

      if (sessionHasExpired(
          {
            sessionCreatedAt: presented.sessionCreatedAt,
            tokenIssuedAt: presented.tokenIssuedAt,
            remembered: presented.sessionRemembered,
          },
          now,
        )) {
        return { kind: REFRESH_OUTCOME.EXPIRED };
      }

      if (!(await tx.consumeRefreshToken(presented.tokenId, now))) {
        return { kind: REFRESH_OUTCOME.INVALID };
      }
      await tx.issueRefreshToken(presented.sessionId, next.hash, now);

      // For the response's identity block. The account outliving its session is guaranteed by
      // the FK — a deleted account cascades its sessions, so the token lookup would have missed.
      const account = await tx.findAccountById(presented.accountId);
      if (account === null) return { kind: REFRESH_OUTCOME.INVALID };

      return {
        kind: REFRESH_OUTCOME.ROTATED,
        account,
        sessionId: presented.sessionId,
        sessionCreatedAt: presented.sessionCreatedAt,
        sessionRemembered: presented.sessionRemembered,
      };
    });

    if (outcome.kind === REFRESH_OUTCOME.INVALID) throw new SessionInvalidError();
    if (outcome.kind === REFRESH_OUTCOME.EXPIRED) throw new SessionExpiredError();

    const accessTokenExpiresAt = new Date(now.getTime() + ACCESS_TOKEN_TTL_MS);
    return {
      account: outcome.account,
      sessionId: outcome.sessionId,
      accessToken: await this.signer.sign(outcome.sessionId, accessTokenExpiresAt),
      accessTokenExpiresAt,
      refreshToken: next.value,
      refreshTokenExpiresAt: sessionExpiresAt({
        sessionCreatedAt: outcome.sessionCreatedAt,
        tokenIssuedAt: now,
        // Rotation rolls the idle window; it never changes which pair bounds the session.
        remembered: outcome.sessionRemembered,
      }),
    };
  }
}
