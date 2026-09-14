import { passwordMeetsPolicy } from '@easyesg/validation';
import type { Clock } from '@api/contracts/clock.port';
import { PasswordPolicyViolationError } from '@api/modules/identity/account/errors/account.errors';
import type { PasswordHasher } from '@api/modules/identity/account/interfaces/password-hasher.interface';
import type { AdminCredentialStore } from '../interfaces/admin-credential-store.interface';
import type { AdminPasswordChanged } from '../models/admin-credentials.model';
import { ADMIN_SESSION_REVOKED_REASON } from '../models/admin-session.model';
import { reauthenticateOperator } from './reauthenticate-operator';

export interface ChangeAdminPasswordCommand {
  readonly accountId: string;
  /** The session making the request — spared by the termination, FR-7's "other". From the request context, never the body. */
  readonly sessionId: string;
  readonly currentPassword: string;
  readonly password: string;
  /** FR-7's election, opt-in and false when absent: a routine change signs no device out unasked. */
  readonly terminateOtherSessions?: boolean;
  /** For the realm's re-authentication window. Absent until task 71 configures trust-proxy. */
  readonly clientIp?: string;
}

/**
 * UC-212 step one — an operator changes their own password (task 144; FR-80), the tenant
 * `ChangePassword`'s shape over the admin realm.
 *
 * **The policy is checked first**, so a refused new password costs typing and not an attempt — OQ-51's
 * policy, from `@easyesg/validation`, the copy the tenant realm and A-20 already share. **The replacement
 * and the termination commit together**, so no crash leaves the new password live beside the sessions the
 * operator asked to end.
 *
 * **What it does not do: release a lock or clear a failure count.** The tenant change clears the lockout
 * because that realm's release is a reset link and a replaced password is where it lands; this realm has
 * no reset flow, and its releases are A-08's and a recovery sign-in's (§12.5.6's task-144 row).
 */
export class ChangeAdminPassword {
  constructor(
    private readonly store: AdminCredentialStore,
    private readonly hasher: PasswordHasher,
    private readonly now: Clock,
  ) {}

  async execute(command: ChangeAdminPasswordCommand): Promise<AdminPasswordChanged> {
    if (!passwordMeetsPolicy(command.password)) throw new PasswordPolicyViolationError();

    await reauthenticateOperator({
      store: this.store,
      hasher: this.hasher,
      now: this.now,
      command: {
        accountId: command.accountId,
        password: command.currentPassword,
        clientIp: command.clientIp,
      },
    });

    // Hashed outside the unit of work, for `reauthenticateOperator`'s reason about Argon2id.
    const passwordHash = await this.hasher.hash(command.password);

    return this.store.run(async (tx) => {
      const at = this.now();
      await tx.replacePassword({ accountId: command.accountId, passwordHash, at });
      if (command.terminateOtherSessions !== true) return { otherSessionsTerminated: 0 };

      const terminated = await tx.revokeOtherSessions({
        accountId: command.accountId,
        exceptSessionId: command.sessionId,
        reason: ADMIN_SESSION_REVOKED_REASON.PASSWORD_CHANGED,
        at,
      });
      return { otherSessionsTerminated: terminated };
    });
  }
}
