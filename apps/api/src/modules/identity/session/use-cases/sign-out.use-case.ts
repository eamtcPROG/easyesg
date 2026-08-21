import { hashRefreshToken } from '../domain/refresh-token';
import type { SessionStore } from '../interfaces/session-store.interface';
import { SESSION_REVOKED_REASON } from '../models/session.model';

export interface SignOutCommand {
  readonly refreshToken: string;
}

/**
 * UC-06 — log out (FR-5): the session is terminated SERVER-SIDE, which is the requirement's whole
 * content — clearing the cookie is the web tier's cosmetic half, and after this commits the
 * refresh token is dead however many copies of it exist. The access token dies by its own `exp`
 * within 15 minutes, and once task 28's guard resolves every request through the session record,
 * revocation here cuts even that window to the next request.
 *
 * **Authenticated by the refresh token itself, not by a bearer access token** — possession of the
 * 256-bit secret is proof enough of the right to end its session, it is what the web proxy
 * actually holds (AD-9), and it keeps sign-out working in the very state UC-07 describes: access
 * token expired, user walking away.
 *
 * **Void and idempotent, on every path.** Unknown token, rotated-away token, already-revoked
 * session — all return the same nothing the happy path returns (`204`). Sign-out must never be
 * the endpoint that confirms whether a guessed token was ever real, and "log out twice" is a
 * double-click, not an error. A consumed token still revokes: whoever holds any generation of a
 * session's tokens could kill it via reuse detection anyway, so refusing here would add a
 * distinction with no security content.
 */
export class SignOut {
  constructor(
    private readonly store: SessionStore,
    private readonly now: () => Date,
  ) {}

  async execute(command: SignOutCommand): Promise<void> {
    const now = this.now();
    const presentedHash = hashRefreshToken(command.refreshToken);

    await this.store.run(async (tx) => {
      const presented = await tx.findRefreshToken(presentedHash);
      if (presented === null || presented.sessionRevokedAt !== null) return;
      await tx.revokeSession(presented.sessionId, SESSION_REVOKED_REASON.SIGNED_OUT, now);
    });
  }
}
