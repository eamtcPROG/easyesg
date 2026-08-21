import { hashRefreshToken } from '@api/modules/identity/session/domain/refresh-token';
import type { AdminSessionStore } from '../interfaces/admin-session-store.interface';
import { ADMIN_SESSION_REVOKED_REASON } from '../models/admin-session.model';
import type { Clock } from '@api/contracts/clock.port';

export interface SignOutAdminCommand {
  readonly refreshToken: string;
}

/**
 * End the elevated session (task 23) — the tenant `SignOut`'s shape: possession of the refresh
 * token is the authentication (it is what the sealed cookie actually holds, and it outlives the
 * access token), and the answer is identical for live, already-revoked and never-issued tokens
 * alike — signing out is not an endpoint that confirms anything.
 */
export class SignOutAdmin {
  constructor(
    private readonly store: AdminSessionStore,
    private readonly now: Clock,
  ) {}

  async execute(command: SignOutAdminCommand): Promise<void> {
    const now = this.now();
    const hash = hashRefreshToken(command.refreshToken);
    await this.store.run(async (tx) => {
      const presented = await tx.findRefreshToken(hash);
      if (presented === null || presented.sessionRevokedAt !== null) return;
      await tx.revokeSession(presented.sessionId, ADMIN_SESSION_REVOKED_REASON.SIGNED_OUT, now);
    });
  }
}
