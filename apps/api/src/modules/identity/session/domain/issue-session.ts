import type { Account } from '@api/modules/identity/account/models/account.model';
import type { AccessTokenSigner } from '../interfaces/access-token-signer.interface';
import type { IssuedSession, Session } from '../models/session.model';
import { ACCESS_TOKEN_TTL_MS, sessionExpiresAt } from './session-expiry';

/**
 * Assembles the `IssuedSession` a fresh sign-in answers with — password (UC-04) and social
 * (UC-05) alike, which is UC-05's own requirement: "a session identical in scope and lifetime to
 * a password session". Shared so the two paths cannot drift on the one subtle part, the expiry
 * anchors: a fresh session's idle window and absolute cap both anchor on `now`, because sign-in
 * IS the session's creation (`session-expiry.ts` owns the rule; refresh anchors differently).
 *
 * The caller keeps the transaction: minting and `createSession` happen inside whatever else the
 * flow commits (social registration creates the account in the same transaction), and signing
 * happens after commit — this helper is that post-commit half.
 */
export async function finaliseIssuedSession(
  issuance: {
    readonly account: Account;
    readonly session: Session;
    /** The raw minted value — the hash went to `createSession`, this goes to the caller. */
    readonly refreshTokenValue: string;
    readonly now: Date;
  },
  signer: AccessTokenSigner,
): Promise<IssuedSession> {
  const accessTokenExpiresAt = new Date(issuance.now.getTime() + ACCESS_TOKEN_TTL_MS);
  return {
    account: issuance.account,
    sessionId: issuance.session.id,
    accessToken: await signer.sign(issuance.session.id, accessTokenExpiresAt),
    accessTokenExpiresAt,
    refreshToken: issuance.refreshTokenValue,
    refreshTokenExpiresAt: sessionExpiresAt({
      sessionCreatedAt: issuance.session.createdAt,
      tokenIssuedAt: issuance.now,
    }),
  };
}
