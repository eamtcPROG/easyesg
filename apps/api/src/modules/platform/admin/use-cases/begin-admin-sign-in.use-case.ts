import {
  LOCKOUT_THRESHOLD,
  adminSignInThrottleKey,
  admitAuthAttempt,
} from '@api/modules/identity/account/domain/auth-throttle';
import { normaliseEmail } from '@api/modules/identity/account/domain/email-address';
import { AuthRateLimitedError } from '@api/modules/identity/account/errors/account.errors';
import type { PasswordHasher } from '@api/modules/identity/account/interfaces/password-hasher.interface';
import { mintRefreshToken } from '@api/modules/identity/session/domain/refresh-token';
import {
  AdminAccountLockedError,
  AdminCredentialInvalidError,
} from '../errors/admin-session.errors';
import type {
  AdminSessionStore,
  AdminSessionTransaction,
} from '../interfaces/admin-session-store.interface';
import type { AdminAccount, AdminIdentity } from '../models/admin-session.model';
import type { Clock } from '@api/contracts/clock.port';
import type { SystemAuditLog } from '@api/contracts/system-audit-log.port';
import { AUDIT_ACTION, auditSubject } from '@api/modules/platform/audit/models/audit-action.model';

export interface BeginAdminSignInCommand {
  readonly email: string;
  readonly password: string;
  /** For §12.5.6's per-(IP, account) window. Absent until task 71 configures trust-proxy. */
  readonly clientIp?: string;
}

/** What step one hands the service to seal: who was verified, and when the clock started. */
export interface AdminFactorChallenge {
  readonly identity: AdminIdentity;
  readonly issuedAt: Date;
}

/**
 * UC-68, step one — verify the elevated credential and open the factor challenge (task 23,
 * reshaped by the 24 Aug 2026 review: A-01 draws the second factor as its own step, and the
 * owner chose the real handshake over presentational staging, so "Signed in as …" on the
 * factor screen is a fact the server established rather than copy).
 *
 * This is the front half of the retired one-shot `SignInAdmin`, semantics preserved exactly:
 * several short transactions so failures count durably while the request answers 401 (the
 * store header's argument), the uniform `AdminCredentialInvalidError` timed alike by burning a
 * real Argon2id verification on the no-account paths, and the lockout check ahead of
 * verification so a locked credential ends the oracle.
 *
 * **What step one deliberately does NOT do:** touch the TOTP secret, issue any token, or clear
 * the failure count — a verified password ends nothing that FR-4's threshold counts, because
 * the factor behind it may still be under attack; only the completed pair clears (step two).
 */
export class BeginAdminSignIn {
  private dummyHash?: string;

  constructor(
    private readonly store: AdminSessionStore,
    private readonly hasher: PasswordHasher,
    private readonly audit: SystemAuditLog,
    private readonly now: Clock,
  ) {}

  async execute(command: BeginAdminSignInCommand): Promise<AdminFactorChallenge> {
    const email = normaliseEmail(command.email);
    const now = this.now();

    // The subject for every event below: a digest of what was presented, so repeated attempts
    // against one address group whether or not it names an account (§12.5.6, task 28.4).
    const subject = auditSubject(email);

    const gate = await this.store.run((tx) => this.admitAttempt(tx, command.clientIp, email, now));
    if (gate.limited) {
      // Recorded before the throw and on its own connection — the port's contract. A refusal IS
      // the event, so a write inside the caller's transaction would be rolled back by it.
      await this.audit.record({ action: AUDIT_ACTION.ADMIN_SIGN_IN_THROTTLED, subject });
      throw new AuthRateLimitedError();
    }
    const account = gate.account;

    if (account?.lockedAt) {
      await this.audit.record({
        action: AUDIT_ACTION.ADMIN_SIGN_IN_BLOCKED,
        actorId: account.id,
        subject,
      });
      throw new AdminAccountLockedError();
    }

    const passwordMatches =
      account !== null
        ? await this.hasher.verify({ digest: account.passwordHash, password: command.password })
        : await this.burnVerificationTime(command.password);

    if (account === null || !passwordMatches) {
      if (account !== null) {
        await this.store.run((tx) => tx.registerFailedSignIn(account.id, LOCKOUT_THRESHOLD, now));
      }
      // **One action for both**, mirroring the single `AdminCredentialInvalidError`: an unknown
      // address and a wrong password are indistinguishable on the wire (NFR-64), and a log that
      // told them apart would be the oracle the uniform response exists to prevent. `actorId`
      // still separates them for an operator who is entitled to the difference — it resolves only
      // where an account did.
      await this.audit.record({
        action: AUDIT_ACTION.ADMIN_SIGN_IN_CREDENTIAL_REFUSED,
        actorId: account?.id ?? null,
        subject,
      });
      throw new AdminCredentialInvalidError();
    }

    return {
      identity: { id: account.id, email: account.email, role: account.role },
      issuedAt: now,
    };
  }

  private async admitAttempt(
    tx: AdminSessionTransaction,
    clientIp: string | undefined,
    email: string,
    now: Date,
  ): Promise<{ limited: true; account?: never } | { limited: false; account: AdminAccount | null }> {
    const key = adminSignInThrottleKey(clientIp, email);
    if (!(await admitAuthAttempt(tx, { key, now }))) return { limited: true };
    return { limited: false, account: await tx.findAdminAccountByEmail(email) };
  }

  /** See `SignIn.burnVerificationTime` — the hash IS the response time (NFR-64). */
  private async burnVerificationTime(password: string): Promise<false> {
    this.dummyHash ??= await this.hasher.hash(mintRefreshToken().value);
    await this.hasher.verify({ digest: this.dummyHash, password });
    return false;
  }
}
