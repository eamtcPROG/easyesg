import type { Clock } from '@api/contracts/clock.port';
import type { SystemAuditLog } from '@api/contracts/system-audit-log.port';
import {
  LOCKOUT_THRESHOLD,
  adminRecoveryThrottleKey,
  admitAuthAttempt,
} from '@api/modules/identity/account/domain/auth-throttle';
import { emailIdentityKey } from '@api/modules/identity/account/domain/email-address';
import { hashRecoveryCode } from '@api/modules/identity/account/domain/recovery-code';
import { AuthRateLimitedError } from '@api/modules/identity/account/errors/account.errors';
import type { PasswordHasher } from '@api/modules/identity/account/interfaces/password-hasher.interface';
import { mintRefreshToken } from '@api/modules/identity/session/domain/refresh-token';
import { AUDIT_ACTION, auditSubject } from '@api/modules/platform/audit/models/audit-action.model';
import { AdminRecoveryRefusedError } from '../errors/admin-session.errors';
import type { AdminSessionStore } from '../interfaces/admin-session-store.interface';
import type { AdminTokens } from '../interfaces/admin-token.interface';
import type { AdminAccount, IssuedAdminSession } from '../models/admin-session.model';
import { issuedAdminSession } from './issued-admin-session';

export interface RecoverAdminSignInCommand {
  readonly email: string;
  readonly password: string;
  /** As the operator typed it — grouped or not, in either case; `hashRecoveryCode` normalises. */
  readonly recoveryCode: string;
  /** For the recovery window. Absent until task 71 configures trust-proxy. */
  readonly clientIp?: string;
}

export interface RecoveredAdminSession extends IssuedAdminSession {
  /** Unspent codes left after the one this sign-in spent — what A-01's notice counts down. */
  readonly recoveryCodesRemaining: number;
}

/**
 * UC-212's way back in — a sign-in with the password and one recovery code, for an operator whose
 * authenticator is lost **or whose account is locked** (task 144; `architecture.md` §12.5.6's task-144 row).
 *
 * **The code is judged before the password, and that ordering is the design.** A-01 refuses a locked
 * account before it verifies anything, so a lock ends password guessing. This route admits a locked
 * account, and judging the password first would reopen exactly that oracle; judged second, a password is
 * verified only for a caller already holding an unspent code — about 80 bits, a space nobody walks — so the
 * lock's guarantee stands. The two refusals a caller without a code can reach, no account and no such code,
 * take the same path and neither verifies a hash, so their timing says nothing either.
 *
 * **Short units of work, and one at the end that does everything success does**: the conditional spend
 * (two requests carrying one code admit once), the released lock and cleared failure count, and the
 * session. A refusal commits its failure count first and throws after, sign-in's shape for sign-in's
 * reason — a refusal must durably count.
 *
 * **Every refusal is one answer** — an unknown or inactive address, a wrong or spent code, a wrong
 * password — counted toward FR-4's lockout wherever an account resolved, and written to the system audit
 * log here, since no session-bearing request carries it. The subject is sign-in's digest of the address,
 * so recovery attempts group with the sign-ins against the same operator.
 */
export class RecoverAdminSignIn {
  constructor(
    private readonly store: AdminSessionStore,
    private readonly hasher: PasswordHasher,
    private readonly tokens: AdminTokens,
    private readonly audit: SystemAuditLog,
    private readonly now: Clock,
  ) {}

  async execute(command: RecoverAdminSignInCommand): Promise<RecoveredAdminSession> {
    const email = emailIdentityKey(command.email);
    const now = this.now();
    const subject = auditSubject(email);
    const codeHash = hashRecoveryCode(command.recoveryCode);

    const key = adminRecoveryThrottleKey(command.clientIp, email);
    const gate = await this.store.run(async (tx) => {
      if (!(await admitAuthAttempt(tx, { key, now }))) return { limited: true as const };
      const found = await tx.findAdminAccountByEmail(email);
      const codeHeld =
        found !== null && (await tx.holdsUnspentRecoveryCode({ accountId: found.id, codeHash }));
      return { limited: false as const, account: found, codeHeld };
    });
    if (gate.limited) {
      await this.audit.record({ action: AUDIT_ACTION.ADMIN_SIGN_IN_THROTTLED, subject });
      throw new AuthRateLimitedError();
    }

    const { account } = gate;
    if (account === null || !gate.codeHeld) throw await this.refusal({ account, subject, now });

    const passwordMatches = await this.hasher.verify({
      digest: account.passwordHash,
      password: command.password,
    });
    if (!passwordMatches) throw await this.refusal({ account, subject, now });

    const minted = mintRefreshToken();
    const recovered = await this.store.run(async (tx) => {
      if (!(await tx.spendRecoveryCode({ accountId: account.id, codeHash, at: now }))) return null;
      await tx.releaseLock(account.id, now);
      return {
        session: await tx.createSession(account.id, minted.hash, now),
        remaining: await tx.countUnspentRecoveryCodes(account.id),
      };
    });
    // A concurrent request carrying the same code spent it between the judgement and the spend.
    if (recovered === null) throw await this.refusal({ account, subject, now });

    await this.audit.record({
      action: AUDIT_ACTION.ADMIN_SIGN_IN_RECOVERED,
      actorId: account.id,
      subject,
    });

    const issued = await issuedAdminSession({
      tokens: this.tokens,
      account,
      session: recovered.session,
      refreshToken: minted.value,
      now,
    });
    return { ...issued, recoveryCodesRemaining: recovered.remaining };
  }

  /** Counts the failure where an account resolved and records it — both committed before the caller throws. */
  private async refusal(input: {
    readonly account: AdminAccount | null;
    readonly subject: Buffer;
    readonly now: Date;
  }): Promise<AdminRecoveryRefusedError> {
    const { account } = input;
    if (account !== null) {
      await this.store.run((tx) => tx.registerFailedSignIn(account.id, LOCKOUT_THRESHOLD, input.now));
    }
    await this.audit.record({
      action: AUDIT_ACTION.ADMIN_SIGN_IN_RECOVERY_REFUSED,
      actorId: account?.id ?? null,
      subject: input.subject,
    });
    return new AdminRecoveryRefusedError();
  }
}
