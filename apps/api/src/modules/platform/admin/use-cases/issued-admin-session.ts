import {
  ADMIN_ACCESS_TOKEN_TTL_MS,
  adminSessionExpiresAt,
} from '../domain/admin-session-expiry';
import type { AdminTokens } from '../interfaces/admin-token.interface';
import type {
  AdminIdentity,
  AdminSession,
  IssuedAdminSession,
} from '../models/admin-session.model';

/**
 * A completed sign-in's session as the service seals it (tasks 23, 144) — the access token signed and the
 * two lifetimes computed from the session just created.
 *
 * **Shared by the two ways a sign-in completes** — A-01's code, and a recovery code — so the realm's
 * lifetimes are computed in one place however the operator got in. Two copies would agree until one of
 * them moved.
 */
export async function issuedAdminSession(input: {
  readonly tokens: AdminTokens;
  readonly account: AdminIdentity;
  readonly session: AdminSession;
  readonly refreshToken: string;
  readonly now: Date;
}): Promise<IssuedAdminSession> {
  const { account, session, now } = input;
  const accessTokenExpiresAt = new Date(now.getTime() + ADMIN_ACCESS_TOKEN_TTL_MS);

  return {
    identity: { id: account.id, email: account.email, role: account.role },
    sessionId: session.id,
    accessToken: await input.tokens.sign(session.id, accessTokenExpiresAt),
    accessTokenExpiresAt,
    refreshToken: input.refreshToken,
    refreshTokenExpiresAt: adminSessionExpiresAt({
      sessionCreatedAt: session.createdAt,
      tokenIssuedAt: now,
    }),
  };
}
