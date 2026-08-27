import {
  LOCKOUT_THRESHOLD,
  adminSignInThrottleKey,
  admitAuthAttempt,
} from '@api/modules/identity/account/domain/auth-throttle';
import { AuthRateLimitedError } from '@api/modules/identity/account/errors/account.errors';
import { mintRefreshToken } from '@api/modules/identity/session/domain/refresh-token';
import type { AdminChallengePayload } from '../domain/admin-challenge-codec';
import {
  ADMIN_ACCESS_TOKEN_TTL_MS,
  adminChallengeHasExpired,
  adminSessionExpiresAt,
} from '../domain/admin-session-expiry';
import { verifyTotp } from '../domain/totp';
import {
  AdminAccountLockedError,
  AdminFactorInvalidError,
  AdminSessionInvalidError,
} from '../errors/admin-session.errors';
import type { AdminSessionStore } from '../interfaces/admin-session-store.interface';
import type { AdminTokens } from '../interfaces/admin-token.interface';
import type { IssuedAdminSession } from '../models/admin-session.model';
import type { Clock } from '@api/contracts/clock.port';
import type { SystemAuditLog } from '@api/contracts/system-audit-log.port';
import { AUDIT_ACTION, auditSubject } from '@api/modules/platform/audit/models/audit-action.model';

export interface CompleteAdminSignInCommand {
  readonly challenge: AdminChallengePayload;
  readonly totpCode: string;
  /** Same §12.5.6 window as step one — the two steps spend one budget. */
  readonly clientIp?: string;
}

/**
 * UC-68, step two — the factor against an open challenge, then the session (task 23, reshaped
 * 24 Aug 2026; `begin-admin-sign-in.use-case.ts` carries the handshake's why).
 *
 * The challenge arrives UNSEALED — the service owns the codec — but never trusted beyond what
 * it proves: that step one verified this account's password at `issuedAt`. Everything
 * decayable is re-established here: the TTL (expired → the generic invalid answer, and the
 * screen returns to step one), the account itself (re-read, active-only — a deactivation or a
 * lock landed mid-challenge wins), and the secret (fresh from the row, not the payload, which
 * deliberately never carries it).
 *
 * A wrong code counts toward the lockout AND spends the throttle window — the exact §12.5.6
 * accounting the one-shot flow had, so splitting the flow widened no guessing budget. What a
 * wrong code does NOT do is consume the challenge: A-01's "failed factor" is a recoverable
 * state, and bouncing a typo back to the password step would punish the person the grace
 * exists for while costing the attacker nothing (their budget is the throttle and lockout
 * either way). Only full success clears the count, exactly as before.
 */
export class CompleteAdminSignIn {
  constructor(
    private readonly store: AdminSessionStore,
    private readonly tokens: AdminTokens,
    private readonly audit: SystemAuditLog,
    private readonly now: Clock,
  ) {}

  async execute(command: CompleteAdminSignInCommand): Promise<IssuedAdminSession> {
    const now = this.now();

    if (adminChallengeHasExpired(command.challenge.issuedAt, now)) {
      throw new AdminSessionInvalidError();
    }

    // The same digest the credential step recorded, so both halves of one sign-in group together.
    const subject = auditSubject(command.challenge.email);

    const key = adminSignInThrottleKey(command.clientIp, command.challenge.email);
    const gate = await this.store.run(async (tx) => {
      if (!(await admitAuthAttempt(tx, { key, now }))) return { limited: true as const };
      return {
        limited: false as const,
        account: await tx.findAdminAccountById(command.challenge.accountId),
      };
    });
    if (gate.limited) {
      await this.audit.record({ action: AUDIT_ACTION.ADMIN_SIGN_IN_THROTTLED, subject });
      throw new AuthRateLimitedError();
    }

    // Re-read, never trusted from the payload: deactivated answers null (the challenge is
    // dead), and a lock that landed since step one refuses before any code is judged.
    const account = gate.account;
    if (account === null) throw new AdminSessionInvalidError();
    if (account.lockedAt) {
      await this.audit.record({
        action: AUDIT_ACTION.ADMIN_SIGN_IN_BLOCKED,
        actorId: account.id,
        subject,
      });
      throw new AdminAccountLockedError();
    }

    if (!verifyTotp({ secret: account.totpSecret, code: command.totpCode }, now)) {
      await this.audit.record({
        action: AUDIT_ACTION.ADMIN_SIGN_IN_FACTOR_REFUSED,
        actorId: account.id,
        subject,
      });
      await this.store.run((tx) => tx.registerFailedSignIn(account.id, LOCKOUT_THRESHOLD, now));
      throw new AdminFactorInvalidError();
    }

    const minted = mintRefreshToken();
    const session = await this.store.run(async (tx) => {
      await tx.clearFailedSignIns(account.id);
      return tx.createSession(account.id, minted.hash, now);
    });

    // **The success event is recorded here and not at the credential step**, because a sign-in is
    // the pair: FR-75 makes the second factor mandatory, so a correct password alone admits nobody
    // and a row saying otherwise would overstate what happened. The log records outcomes, not steps.
    await this.audit.record({
      action: AUDIT_ACTION.ADMIN_SIGN_IN_SUCCEEDED,
      actorId: account.id,
      subject,
    });

    const accessTokenExpiresAt = new Date(now.getTime() + ADMIN_ACCESS_TOKEN_TTL_MS);
    return {
      identity: { id: account.id, email: account.email, role: account.role },
      sessionId: session.id,
      accessToken: await this.tokens.sign(session.id, accessTokenExpiresAt),
      accessTokenExpiresAt,
      refreshToken: minted.value,
      refreshTokenExpiresAt: adminSessionExpiresAt({
        sessionCreatedAt: session.createdAt,
        tokenIssuedAt: now,
      }),
    };
  }
}
