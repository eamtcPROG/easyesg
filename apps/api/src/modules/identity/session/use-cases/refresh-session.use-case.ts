import type { Account } from '@api/modules/identity/account/models/account.model';
import { REFRESH_REUSE_GRACE_MS, hashRefreshToken, mintRefreshToken } from '../domain/refresh-token';
import { ACCESS_TOKEN_TTL_MS, sessionExpiresAt, sessionHasExpired } from '../domain/session-expiry';
import { SessionExpiredError, SessionInvalidError } from '../errors/session.errors';
import type { AccessTokenSigner } from '../interfaces/access-token-signer.interface';
import type { SessionStore } from '../interfaces/session-store.interface';
import { SESSION_REVOKED_REASON, type IssuedSession } from '../models/session.model';

export interface RefreshSessionCommand {
  readonly refreshToken: string;
}

type RefreshOutcome =
  | { kind: 'invalid' }
  | { kind: 'expired' }
  | { kind: 'rotated'; account: Account; sessionId: string; sessionCreatedAt: Date };

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
    private readonly now: () => Date,
  ) {}

  async execute(command: RefreshSessionCommand): Promise<IssuedSession> {
    const now = this.now();
    const presentedHash = hashRefreshToken(command.refreshToken);
    const next = mintRefreshToken();

    const outcome = await this.store.run<RefreshOutcome>(async (tx) => {
      const presented = await tx.findRefreshToken(presentedHash);
      if (presented === null || presented.sessionRevokedAt !== null) return { kind: 'invalid' };

      if (presented.tokenConsumedAt !== null) {
        if (now.getTime() - presented.tokenConsumedAt.getTime() > REFRESH_REUSE_GRACE_MS) {
          await tx.revokeSession(presented.sessionId, SESSION_REVOKED_REASON.REFRESH_REUSED, now);
        }
        return { kind: 'invalid' };
      }

      if (sessionHasExpired(presented.sessionCreatedAt, presented.tokenIssuedAt, now)) {
        return { kind: 'expired' };
      }

      if (!(await tx.consumeRefreshToken(presented.tokenId, now))) return { kind: 'invalid' };
      await tx.issueRefreshToken(presented.sessionId, next.hash, now);

      // For the response's identity block. The account outliving its session is guaranteed by
      // the FK — a deleted account cascades its sessions, so the token lookup would have missed.
      const account = await tx.findAccountById(presented.accountId);
      if (account === null) return { kind: 'invalid' };

      return {
        kind: 'rotated',
        account,
        sessionId: presented.sessionId,
        sessionCreatedAt: presented.sessionCreatedAt,
      };
    });

    if (outcome.kind === 'invalid') throw new SessionInvalidError();
    if (outcome.kind === 'expired') throw new SessionExpiredError();

    const accessTokenExpiresAt = new Date(now.getTime() + ACCESS_TOKEN_TTL_MS);
    return {
      account: outcome.account,
      sessionId: outcome.sessionId,
      accessToken: await this.signer.sign(outcome.sessionId, accessTokenExpiresAt),
      accessTokenExpiresAt,
      refreshToken: next.value,
      refreshTokenExpiresAt: sessionExpiresAt(outcome.sessionCreatedAt, now),
    };
  }
}
