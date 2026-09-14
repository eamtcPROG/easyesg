import type { Clock } from '@api/contracts/clock.port';
import type { PasswordHasher } from '@api/modules/identity/account/interfaces/password-hasher.interface';
import { ADMIN_TOTP_ISSUER, mintTotpSecret, totpEnrolmentUri } from '../domain/totp';
import { AdminSessionInvalidError } from '../errors/admin-session.errors';
import type { AdminCredentialStore } from '../interfaces/admin-credential-store.interface';
import { reauthenticateOperator, type OperatorReauthentication } from './reauthenticate-operator';
import type { AdminEnrolmentOffer } from './stage-admin-enrolment.use-case';

export type BeginAdminReenrolmentCommand = OperatorReauthentication;

/**
 * UC-212 step two, its first half — a new second factor staged beside the one in force (task 144).
 *
 * **A fresh secret on every call, replacing any staged before it**, where A-20's staging answers the same
 * secret twice. There the link is the capability and a reload must not invalidate a scan; here each call
 * proves the password again and returns the only copy the operator will ever see, so an earlier secret
 * that was never confirmed has nobody left holding it.
 *
 * **The factor in force is untouched.** Until a confirming code arrives it still signs the operator in,
 * which is what lets a scan that silently failed lock nobody out (A-19). The URI carries the realm's own
 * issuer and the operator's address, task 143's rule for what a phone shows.
 */
export class BeginAdminReenrolment {
  constructor(
    private readonly store: AdminCredentialStore,
    private readonly hasher: PasswordHasher,
    private readonly now: Clock,
  ) {}

  async execute(command: BeginAdminReenrolmentCommand): Promise<AdminEnrolmentOffer> {
    const credential = await reauthenticateOperator({
      store: this.store,
      hasher: this.hasher,
      now: this.now,
      command,
    });

    const secret = mintTotpSecret();
    const staged = await this.store.run((tx) =>
      tx.stageTotpSecret({ accountId: command.accountId, secret, at: this.now() }),
    );
    // Suspended or removed between the password and the write.
    if (!staged) throw new AdminSessionInvalidError();

    return {
      secret,
      uri: totpEnrolmentUri({ issuer: ADMIN_TOTP_ISSUER, email: credential.email, secret }),
    };
  }
}
